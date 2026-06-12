from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


DEPOT = {
    "name": "Suncity School",
    "address": "Suncity School, Suncity Road, Sun City, Sector 54, Gurgaon, Gurugram, Haryana, 122002, India",
    "latitude": 28.434364,
    "longitude": 77.112579,
}


class Location(BaseModel):
    name: str = "Suncity School"
    address: str = DEPOT["address"]
    latitude: float = DEPOT["latitude"]
    longitude: float = DEPOT["longitude"]


class Order(BaseModel):
    id: str
    customer_name: str
    address: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    window_start: str
    window_end: str
    notes: str = ""


class Settings(BaseModel):
    drivers: int = Field(default=3, ge=1, le=25)
    depot: Location = Field(default_factory=Location)
    delivery_radius_km: float = Field(default=4.8, gt=0)
    driver_start_time: str = "06:00"
    route_end_time: str = "11:00"
    service_time_minutes: int = Field(default=3, ge=0)
    average_speed_kmh: float = Field(default=20, gt=1)
    routing_mode: str = "road"
    road_provider: str = "osrm"
    osrm_profile: str = "driving"
    osrm_base_url: str = "http://router.project-osrm.org"
    snap_to_road: bool = True
    max_snap_distance_m: float = Field(default=250, gt=0)
    road_request_timeout_seconds: float = Field(default=1.5, gt=0)


class StopResult(BaseModel):
    order: Order
    arrival_time: str
    wait_minutes: float
    lateness_minutes: float
    travel_minutes: float
    distance_km: float
    status: str


class DriverRoute(BaseModel):
    driver_id: int
    stops: list[StopResult]
    total_distance_km: float
    total_route_duration_minutes: float
    total_travel_minutes: float
    maps_link: str
    path: list[dict[str, float]]


class AlgorithmResult(BaseModel):
    algorithm: str
    routes: list[DriverRoute]
    metrics: dict[str, Any]
    warnings: list[str] = []


class OptimizeRequest(BaseModel):
    orders: list[Order]
    settings: Settings = Field(default_factory=Settings)
    algorithm: str = "greedy"


class SimulationGenerateRequest(BaseModel):
    number_of_orders: int = Field(default=40, ge=1, le=500)
    settings: Settings = Field(default_factory=Settings)
    seed: Optional[int] = 42


class SimulationRunRequest(BaseModel):
    orders: list[Order]
    settings: Settings = Field(default_factory=Settings)
    algorithms: list[str] = ["greedy", "clarke_wright", "ortools"]
    simulation_runs: int = Field(default=1, ge=1, le=100)


class ExportRequest(BaseModel):
    results: list[AlgorithmResult]


class GeocodeRequest(BaseModel):
    address: str


class ReverseGeocodeRequest(BaseModel):
    latitude: float
    longitude: float


class RoadSnapRequest(BaseModel):
    latitude: float
    longitude: float
    settings: Settings = Field(default_factory=Settings)


class GeocodeResult(BaseModel):
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    display_name: str = ""
    warning: str = ""
