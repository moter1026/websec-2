from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from server.config import STATIONS_CACHE, STATIONS_CACHE_TTL_SEC
from server.models.station import Station
from server.utils.yandex_client import yandex_get

# Only rail from stations_list (same feed lists bus/plane/water/helicopter stops)
_RAIL_TRANSPORT_TYPES = frozenset({"train", "suburban", "train_station"})


def is_rail_station(s: Station) -> bool:
    t = s.transport_type
    if not t:
        return False
    return t in _RAIL_TRANSPORT_TYPES


@dataclass(frozen=True)
class StationIndex:
    stations: List[Station]
    by_code: Dict[str, Station]


def cache_is_fresh(path: Path, ttl_sec: int) -> bool:
    if not path.exists():
        return False
    age = time.time() - path.stat().st_mtime
    return age < ttl_sec


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


def flatten_stations_list(payload: Dict[str, Any]) -> List[Station]:
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


async def load_station_index() -> StationIndex:
    if cache_is_fresh(STATIONS_CACHE, STATIONS_CACHE_TTL_SEC):
        payload = json.loads(STATIONS_CACHE.read_text(encoding="utf-8"))
    else:
        payload = await yandex_get(
            "stations_list/",
            {
                "format": "json",
            },
        )
        STATIONS_CACHE.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    stations = flatten_stations_list(payload)
    by_code = {s.code: s for s in stations}
    return StationIndex(stations=stations, by_code=by_code)
