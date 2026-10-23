"""SQLAlchemy database models for TransitQ."""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship, DeclarativeBase
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .config import DATABASE_URL


class Base(DeclarativeBase):
    pass


engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class Stop(Base):
    __tablename__ = "stops"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), unique=True, nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    description = Column(Text, nullable=True)
    is_terminal = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    connections_from = relationship("Connection", foreign_keys="Connection.from_stop_id", back_populates="from_stop")
    connections_to = relationship("Connection", foreign_keys="Connection.to_stop_id", back_populates="to_stop")


class Connection(Base):
    __tablename__ = "connections"
    id = Column(Integer, primary_key=True, index=True)
    from_stop_id = Column(Integer, ForeignKey("stops.id"), nullable=False)
    to_stop_id = Column(Integer, ForeignKey("stops.id"), nullable=False)
    distance_km = Column(Float, nullable=False)
    travel_time_min = Column(Float, nullable=False)
    is_bidirectional = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    from_stop = relationship("Stop", foreign_keys=[from_stop_id], back_populates="connections_from")
    to_stop = relationship("Stop", foreign_keys=[to_stop_id], back_populates="connections_to")


class Route(Base):
    __tablename__ = "routes"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    stop_sequence = Column(JSON, nullable=False)  # list of stop IDs
    total_distance_km = Column(Float, default=0.0)
    estimated_duration_min = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    demands = relationship("PassengerDemand", back_populates="route")
    trips = relationship("ScheduledTrip", back_populates="route")


class Bus(Base):
    __tablename__ = "buses"
    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(20), unique=True, nullable=False)
    capacity = Column(Integer, nullable=False)
    is_available = Column(Boolean, default=True)
    depot_stop_id = Column(Integer, ForeignKey("stops.id"), nullable=True)
    fuel_type = Column(String(50), default="Diesel")
    operating_cost_per_km = Column(Float, default=12.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    trips = relationship("ScheduledTrip", back_populates="bus")


class PassengerDemand(Base):
    __tablename__ = "passenger_demands"
    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    time_slot = Column(String(10), nullable=False)   # e.g. "08:00"
    passengers = Column(Integer, nullable=False)
    peak_multiplier = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    route = relationship("Route", back_populates="demands")


class ScheduledTrip(Base):
    __tablename__ = "scheduled_trips"
    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    bus_id = Column(Integer, ForeignKey("buses.id"), nullable=False)
    departure_time = Column(String(10), nullable=False)  # HH:MM
    arrival_time = Column(String(10), nullable=False)
    passengers_served = Column(Integer, default=0)
    status = Column(String(20), default="scheduled")  # scheduled, completed, cancelled
    solver_run_id = Column(Integer, ForeignKey("solver_runs.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    route = relationship("Route", back_populates="trips")
    bus = relationship("Bus", back_populates="trips")
    solver_run = relationship("SolverRun", back_populates="trips")


class SolverRun(Base):
    __tablename__ = "solver_runs"
    id = Column(Integer, primary_key=True, index=True)
    solver_type = Column(String(50), nullable=False)  # classical, simulated_annealing, qubo
    status = Column(String(20), default="pending")   # pending, running, completed, failed
    runtime_seconds = Column(Float, nullable=True)
    total_trips = Column(Integer, default=0)
    demand_served = Column(Integer, default=0)
    total_demand = Column(Integer, default=0)
    avg_waiting_time_min = Column(Float, nullable=True)
    operating_cost = Column(Float, nullable=True)
    vehicle_utilization = Column(Float, nullable=True)
    feasible = Column(Boolean, nullable=True)
    parameters = Column(JSON, nullable=True)
    result_summary = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    trips = relationship("ScheduledTrip", back_populates="solver_run")
