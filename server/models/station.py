from typing import Optional

from pydantic import BaseModel


class Station(BaseModel):
    code: str
    title: str
    country: Optional[str] = None
    region: Optional[str] = None
    settlement: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    transport_type: Optional[str] = None
