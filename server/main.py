from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

load_dotenv()


YANDEX_BASE = "https://api.rasp.yandex.net/v3.0"


def _env(name: str, default: Optional[str] = None) -> str:
    val = os.getenv(name, default)
    if val is None or val.strip() == "":
        raise RuntimeError(f"Missing required env var: {name}")
    return val


def _opt_env(name: str, default: str) -> str:
    val = os.getenv(name, default)
    return val if val is not None else default


API_KEY = os.getenv("YANDEX_RASP_API_KEY", "").strip()
LANG = _opt_env("YANDEX_RASP_LANG", "ru_RU")

CACHE_DIR = Path(__file__).resolve().parent / ".cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
STATIONS_CACHE = CACHE_DIR / "stations_list.json"
STATIONS_CACHE_TTL_SEC = 7 * 24 * 60 * 60


class Station(BaseModel):
    code: str
    title: str
    country: Optional[str] = None
    region: Optional[str] = None
    settlement: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    transport_type: Optional[str] = None


# Only rail from stations_list (same feed lists bus/plane/water/helicopter stops with other transport_type)
_RAIL_TRANSPORT_TYPES = frozenset({"train", "suburban", "train_station"})


def _is_rail_station(s: Station) -> bool:
    t = s.transport_type
    if not t:
        return False
    return t in _RAIL_TRANSPORT_TYPES


@dataclass(frozen=True)
class _StationIndex:
    stations: List[Station]
    by_code: Dict[str, Station]


def _cache_is_fresh(path: Path, ttl_sec: int) -> bool:
    if not path.exists():
        return False
    age = time.time() - path.stat().st_mtime
    return age < ttl_sec


async def _yandex_get(path: str, params: Dict[str, Any]) -> Dict[str, Any]:
    if not API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Server is not configured: set YANDEX_RASP_API_KEY in .env",
        )

    url = f"{YANDEX_BASE}/{path.lstrip('/')}"
    base_params = {"apikey": API_KEY, "lang": LANG}
    merged = {**base_params, **params}

    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(url, params=merged)
        if r.status_code >= 400:
            raise HTTPException(
                status_code=502,
                detail={
                    "message": "Yandex Rasp API error",
                    "status": r.status_code,
                    "body": r.text,
                },
            )
        return r.json()


def _flatten_stations_list(payload: Dict[str, Any]) -> List[Station]:
    def _to_float(val: Any) -> Optional[float]:
        if val is None:
            return None
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, str):
            txt = val.strip()
            if txt == "":
                return None
            try:
                return float(txt)
            except ValueError:
                return None
        return None

    # stations_list returns: countries -> regions -> settlements -> stations
    out: List[Station] = []
    for country in payload.get("countries", []) or []:
        country_title = country.get("title")
        for region in country.get("regions", []) or []:
            region_title = region.get("title")
            for settlement in region.get("settlements", []) or []:
                settlement_title = settlement.get("title")
                for st in settlement.get("stations", []) or []:
                    code = (st.get("codes") or {}).get("yandex_code")
                    title = st.get("title")
                    if not code or not title:
                        continue
                    out.append(
                        Station(
                            code=code,
                            title=title,
                            country=country_title,
                            region=region_title,
                            settlement=settlement_title,
                            lat=_to_float(st.get("lat", st.get("latitude"))),
                            lng=_to_float(st.get("lng", st.get("longitude"))),
                            transport_type=st.get("transport_type"),
                        )
                    )
    return out


async def _load_station_index() -> _StationIndex:
    if _cache_is_fresh(STATIONS_CACHE, STATIONS_CACHE_TTL_SEC):
        payload = json.loads(STATIONS_CACHE.read_text(encoding="utf-8"))
    else:
        payload = await _yandex_get(
            "stations_list/",
            {
                "format": "json",
            },
        )
        STATIONS_CACHE.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    stations = _flatten_stations_list(payload)
    by_code = {s.code: s for s in stations}
    return _StationIndex(stations=stations, by_code=by_code)


app = FastAPI(title="Suburban Rasp Proxy", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_station_index: Optional[_StationIndex] = None


@app.on_event("startup")
async def _startup() -> None:
    global _station_index
    if API_KEY:
        _station_index = await _load_station_index()


@app.get("/api/health")
async def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "has_api_key": bool(API_KEY),
        "stations_cache_exists": STATIONS_CACHE.exists(),
        "stations_cache_fresh": _cache_is_fresh(STATIONS_CACHE, STATIONS_CACHE_TTL_SEC),
    }


@app.get("/api/stations", response_model=List[Station])
async def stations(
    q: str = Query("", min_length=0, max_length=80),
    limit: int = Query(20, ge=1, le=50),
) -> List[Station]:
    global _station_index
    if _station_index is None:
        _station_index = await _load_station_index()

    query = q.strip().lower()
    if not query:
        # Map loads stations via /api/stations/by_bbox; text list stays empty until user searches.
        return []

    hits: List[Tuple[int, Station]] = []
    for st in _station_index.stations:
        if not _is_rail_station(st):
            continue
        title = st.title.lower()
        score = 0
        if title == query:
            score = 100
        elif title.startswith(query):
            score = 80
        elif query in title:
            score = 60
        else:
            continue
        hits.append((score, st))

    hits.sort(key=lambda x: (-x[0], x[1].title))
    return [st for _, st in hits[:limit]]


@app.get("/api/station/{station_code}/schedule")
async def station_schedule(
    station_code: str,
    date: Optional[str] = None,
) -> Dict[str, Any]:
    params: Dict[str, Any] = {
        "station": station_code,
        "transport_types": "suburban",
        "event": "departure",
    }
    if date:
        params["date"] = date
    return await _yandex_get("schedule/", params)


@app.get("/api/stations/by_bbox", response_model=List[Station])
async def stations_by_bbox(
    min_lat: float = Query(...),
    max_lat: float = Query(...),
    min_lng: float = Query(...),
    max_lng: float = Query(...),
    limit: int = Query(300, ge=1, le=1000),
) -> List[Station]:
    """Return train/suburban stations within a geographic bounding box."""
    global _station_index
    if _station_index is None:
        _station_index = await _load_station_index()

    # Clamp to valid ranges
    min_lat = max(-90.0, min_lat)
    max_lat = min(90.0, max_lat)
    min_lng = max(-180.0, min_lng)
    max_lng = min(180.0, max_lng)

    result: List[Station] = []
    for s in _station_index.stations:
        if s.lat is None or s.lng is None:
            continue
        if not _is_rail_station(s):
            continue
        if min_lat <= s.lat <= max_lat and min_lng <= s.lng <= max_lng:
            result.append(s)
            if len(result) >= limit:
                break
    return result


@app.get("/api/route/search")
async def route_search(
    from_code: str = Query(..., alias="from"),
    to_code: str = Query(..., alias="to"),
    date: Optional[str] = None,
) -> Dict[str, Any]:
    params: Dict[str, Any] = {
        "from": from_code,
        "to": to_code,
        "transport_types": "suburban",
        "limit": 100,
    }
    if date:
        params["date"] = date
    return await _yandex_get("search/", params)


WEB_DIR = Path(__file__).resolve().parents[1] / "web"

if WEB_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(WEB_DIR / "assets")), name="assets")


@app.get("/")
async def index() -> Any:
    index_file = WEB_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="web/index.html not found")
    return FileResponse(str(index_file))

