"""Pydantic schemas for request/response validation."""
from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, field_validator


# ── Stop Schemas ──────────────────────────────────────────────
class StopBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    code: str = Field(..., min_length=2, max_length=20)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    is_terminal: bool = False


class StopCreate(StopBase):
    pass


class StopUpdate(BaseModel):
    name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    is_terminal: Optional[bool] = None


class StopOut(StopBase):
    id: int
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Connection Schemas ────────────────────────────────────────
class ConnectionBase(BaseModel):
    from_stop_id: int
    to_stop_id: int
    distance_km: float = Field(..., gt=0)
    travel_time_min: float = Field(..., gt=0)
    is_bidirectional: bool = True


class ConnectionCreate(ConnectionBase):
    pass


class ConnectionOut(ConnectionBase):
    id: int
    from_stop_name: Optional[str] = None
    to_stop_name: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Route Schemas ─────────────────────────────────────────────
class RouteBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    code: str = Field(..., min_length=2, max_length=20)
    stop_sequence: List[int]
    total_distance_km: float = 0.0
    estimated_duration_min: float = 0.0
    is_active: bool = True

    @field_validator("stop_sequence")
    @classmethod
    def validate_stops(cls, v):
        if len(v) < 2:
            raise ValueError("Route must have at least 2 stops")
        return v


class RouteCreate(RouteBase):
    pass


class RouteUpdate(BaseModel):
    name: Optional[str] = None
    stop_sequence: Optional[List[int]] = None
    total_distance_km: Optional[float] = None
    estimated_duration_min: Optional[float] = None
    is_active: Optional[bool] = None


class RouteOut(RouteBase):
    id: int
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Bus Schemas ───────────────────────────────────────────────
class BusBase(BaseModel):
    number: str = Field(..., min_length=2, max_length=20)
    capacity: int = Field(..., ge=1, le=200)
    is_available: bool = True
    depot_stop_id: Optional[int] = None
    fuel_type: str = "Diesel"
    operating_cost_per_km: float = Field(12.0, ge=0)


class BusCreate(BusBase):
    pass


class BusUpdate(BaseModel):
    capacity: Optional[int] = None
    is_available: Optional[bool] = None
    depot_stop_id: Optional[int] = None
    fuel_type: Optional[str] = None
    operating_cost_per_km: Optional[float] = None


class BusOut(BusBase):
    id: int
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Demand Schemas ────────────────────────────────────────────
class DemandBase(BaseModel):
    route_id: int
    time_slot: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    passengers: int = Field(..., ge=0)
    peak_multiplier: float = Field(1.0, ge=0.1, le=10.0)


class DemandCreate(DemandBase):
    pass


class DemandUpdate(BaseModel):
    passengers: Optional[int] = None
    peak_multiplier: Optional[float] = None


class DemandOut(DemandBase):
    id: int
    route_name: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Trip Schemas ──────────────────────────────────────────────
class TripOut(BaseModel):
    id: int
    route_id: int
    bus_id: int
    departure_time: str
    arrival_time: str
    passengers_served: int
    status: str
    route_name: Optional[str] = None
    bus_number: Optional[str] = None
    solver_run_id: Optional[int] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Solver Schemas ────────────────────────────────────────────
class SolverRequest(BaseModel):
    solver_type: str = Field("classical", pattern=r"^(classical|simulated_annealing|qubo)$")
    parameters: Optional[Dict[str, Any]] = None


class SolverRunOut(BaseModel):
    id: int
    solver_type: str
    status: str
    runtime_seconds: Optional[float]
    total_trips: int
    demand_served: int
    total_demand: int
    avg_waiting_time_min: Optional[float]
    operating_cost: Optional[float]
    vehicle_utilization: Optional[float]
    feasible: Optional[bool]
    parameters: Optional[Dict[str, Any]]
    result_summary: Optional[Dict[str, Any]]
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Overview / Metrics ────────────────────────────────────────
class OverviewMetrics(BaseModel):
    total_routes: int
    total_stops: int
    total_buses: int
    available_buses: int
    total_demand: int
    latest_run_id: Optional[int]
    latest_avg_waiting_time: Optional[float]
    latest_demand_served: Optional[int]
    latest_vehicle_utilization: Optional[float]
    latest_operating_cost: Optional[float]
    latest_feasible: Optional[bool]
    solver_runs_count: int
