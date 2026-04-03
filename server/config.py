import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _opt_env(name: str, default: str) -> str:
    val = os.getenv(name, default)
    return val if val is not None else default


API_KEY = os.getenv("YANDEX_RASP_API_KEY", "").strip()
LANG = _opt_env("YANDEX_RASP_LANG", "ru_RU")
YANDEX_BASE = _opt_env("YANDEX_RASP_BASE", "https://api.rasp.yandex.net/v3.0").rstrip("/")

CACHE_DIR = Path(__file__).resolve().parent / ".cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
STATIONS_CACHE = CACHE_DIR / "stations_list.json"
STATIONS_CACHE_TTL_SEC = 7 * 24 * 60 * 60
