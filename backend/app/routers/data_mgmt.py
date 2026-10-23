"""Data management router: CSV imports, validation, dataset status, and demo reset."""
import csv
import io
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from .. import models
from ..models import get_db
from ..seed import seed_demo_data

router = APIRouter(prefix="/data", tags=["data-management"])


@router.get("/status")
def get_data_status(db: Session = Depends(get_db)) -> Dict[str, Any]:
    stops_count = db.query(models.Stop).count()
    routes_count = db.query(models.Route).count()
    buses_count = db.query(models.Bus).count()
    demands_count = db.query(models.PassengerDemand).count()
    connections_count = db.query(models.Connection).count()
    runs_count = db.query(models.SolverRun).count()

    return {
        "dataset_type": "Synthetic Demo (GPREC Illustrative)",
        "is_synthetic": True,
        "disclaimer": "All baseline demo entries are synthetic approximations for QAIC 2027 and not verified real-world GPREC schedules.",
        "counts": {
            "stops": stops_count,
            "connections": connections_count,
            "routes": routes_count,
            "buses": buses_count,
            "demands": demands_count,
            "solver_runs": runs_count,
        }
    }


@router.post("/reset-demo")
def reset_to_demo_data(db: Session = Depends(get_db)):
    """Wipes active schedules, demands, routes, connections, stops, and reseeds initial demo data."""
    db.query(models.ScheduledTrip).delete()
    db.query(models.SolverRun).delete()
    db.query(models.PassengerDemand).delete()
    db.query(models.Route).delete()
    db.query(models.Connection).delete()
    db.query(models.Bus).delete()
    db.query(models.Stop).delete()
    db.commit()

    seed_demo_data(db)
    return {"status": "success", "message": "Reseeded synthetic GPREC demo dataset."}


@router.post("/import/stops")
async def import_stops_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "File must be a CSV format")

    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except Exception:
        decoded = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))
    imported = 0
    errors = []

    for idx, row in enumerate(reader, start=2):
        name = row.get("name", "").strip()
        code = row.get("code", "").strip().upper()
        if not name or not code:
            errors.append(f"Row {idx}: 'name' and 'code' are required.")
            continue

        existing = db.query(models.Stop).filter((models.Stop.code == code) | (models.Stop.name == name)).first()
        if existing:
            continue

        lat = float(row["latitude"]) if row.get("latitude") and row["latitude"].strip() else None
        lon = float(row["longitude"]) if row.get("longitude") and row["longitude"].strip() else None
        is_term = str(row.get("is_terminal", "")).lower() in ("true", "1", "yes")

        stop = models.Stop(
            name=name,
            code=code,
            latitude=lat,
            longitude=lon,
            description=row.get("description", "").strip() or None,
            is_terminal=is_term
        )
        db.add(stop)
        imported += 1

    db.commit()
    return {"imported": imported, "errors": errors}


@router.post("/import/buses")
async def import_buses_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "File must be a CSV format")

    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except Exception:
        decoded = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))
    imported = 0
    errors = []

    for idx, row in enumerate(reader, start=2):
        number = row.get("number", "").strip().upper()
        if not number:
            errors.append(f"Row {idx}: 'number' is required.")
            continue

        try:
            capacity = int(row.get("capacity", 40))
        except ValueError:
            errors.append(f"Row {idx}: Invalid capacity.")
            continue

        try:
            cost = float(row.get("operating_cost_per_km", 12.0))
        except ValueError:
            cost = 12.0

        avail = str(row.get("is_available", "true")).lower() in ("true", "1", "yes")
        fuel = row.get("fuel_type", "Diesel").strip()

        existing = db.query(models.Bus).filter(models.Bus.number == number).first()
        if existing:
            continue

        bus = models.Bus(
            number=number,
            capacity=capacity,
            fuel_type=fuel,
            operating_cost_per_km=cost,
            is_available=avail,
        )
        db.add(bus)
        imported += 1

    db.commit()
    return {"imported": imported, "errors": errors}


@router.post("/import/demands")
async def import_demands_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "File must be a CSV format")

    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except Exception:
        decoded = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))
    imported = 0
    errors = []

    for idx, row in enumerate(reader, start=2):
        route_id_raw = row.get("route_id", "").strip()
        route_code = row.get("route_code", "").strip()
        time_slot = row.get("time_slot", "").strip()

        route = None
        if route_id_raw and route_id_raw.isdigit():
            route = db.get(models.Route, int(route_id_raw))
        elif route_code:
            route = db.query(models.Route).filter(models.Route.code == route_code).first()

        if not route:
            errors.append(f"Row {idx}: Route not found for id '{route_id_raw}' / code '{route_code}'.")
            continue

        if not time_slot:
            errors.append(f"Row {idx}: Missing time_slot.")
            continue

        try:
            pax = int(row.get("passengers", 0))
            mult = float(row.get("peak_multiplier", 1.0))
        except ValueError:
            errors.append(f"Row {idx}: Invalid passengers or peak_multiplier.")
            continue

        demand = models.PassengerDemand(
            route_id=route.id,
            time_slot=time_slot,
            passengers=pax,
            peak_multiplier=mult
        )
        db.add(demand)
        imported += 1

    db.commit()
    return {"imported": imported, "errors": errors}
