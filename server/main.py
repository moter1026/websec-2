from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from server.config import API_KEY, STATIONS_CACHE, STATIONS_CACHE_TTL_SEC
from server.models.station import Station
from server.utils.stations_index import (
    StationIndex,
    cache_is_fresh,
    is_rail_station,
    load_station_index,
)
from server.utils.yandex_client import yandex_get

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

_station_index: Optional[StationIndex] = None


@app.on_event("startup")
async def _startup() -> None:
    global _station_index
    if API_KEY:
        _station_index = await load_station_index()


@app.get("/api/health")
async def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "has_api_key": bool(API_KEY),
        "stations_cache_exists": STATIONS_CACHE.exists(),
        "stations_cache_fresh": cache_is_fresh(STATIONS_CACHE, STATIONS_CACHE_TTL_SEC),
    }


@app.get("/api/stations", response_model=List[Station])
async def stations(
    q: str = Query("", min_length=0, max_length=80),
    limit: int = Query(20, ge=1, le=50),
) -> List[Station]:
    global _station_index
    if _station_index is None:
        _station_index = await load_station_index()

    query = q.strip().lower()
    if not query:
        return []

    hits: List[Tuple[int, Station]] = []
    for st in _station_index.stations:
        if not is_rail_station(st):
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
    return await yandex_get("schedule/", params)


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
        _station_index = await load_station_index()

    min_lat = max(-90.0, min_lat)
    max_lat = min(90.0, max_lat)
    min_lng = max(-180.0, min_lng)
    max_lng = min(180.0, max_lng)

    result: List[Station] = []
    for s in _station_index.stations:
        if s.lat is None or s.lng is None:
            continue
        if not is_rail_station(s):
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
    return await yandex_get("search/", params)


WEB_DIR = Path(__file__).resolve().parents[1] / "web"

if WEB_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(WEB_DIR / "assets")), name="assets")


@app.get("/")
async def index() -> Any:
    index_file = WEB_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="web/index.html not found")
    return FileResponse(str(index_file))
