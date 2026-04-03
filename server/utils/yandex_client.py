from typing import Any, Dict

import httpx
from fastapi import HTTPException

from server.config import API_KEY, LANG, YANDEX_BASE


async def yandex_get(path: str, params: Dict[str, Any]) -> Dict[str, Any]:
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
