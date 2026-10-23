"""Fleet & Demand router."""
import io
import csv
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from .. import models, schemas
from ..models import get_db

router = APIRouter(prefix="/fleet", tags=["fleet"])


# ── Buses ─────────────────────────────────────────────────────
@router.get("/buses", response_model=List[schemas.BusOut])
def list_buses(db: Session = Depends(get_db)):
    return db.query(models.Bus).all()


@router.post("/buses", response_model=schemas.BusOut, status_code=201)
def create_bus(body: schemas.BusCreate, db: Session = Depends(get_db)):
    if db.query(models.Bus).filter(models.Bus.number == body.number).first():
        raise HTTPException(400, f"Bus number '{body.number}' already exists")
    obj = models.Bus(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/buses/{bus_id}", response_model=schemas.BusOut)
def update_bus(bus_id: int, body: schemas.BusUpdate, db: Session = Depends(get_db)):
    obj = db.get(models.Bus, bus_id)
    if not obj:
        raise HTTPException(404, "Bus not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/buses/{bus_id}")
def delete_bus(bus_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.Bus, bus_id)
    if not obj:
        raise HTTPException(404, "Bus not found")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ── Demand ────────────────────────────────────────────────────
@router.get("/demands", response_model=List[schemas.DemandOut])
def list_demands(db: Session = Depends(get_db)):
    demands = db.query(models.PassengerDemand).all()
    result = []
    for d in demands:
        result.append(schemas.DemandOut(
            id=d.id,
            route_id=d.route_id,
            time_slot=d.time_slot,
            passengers=d.passengers,
            peak_multiplier=d.peak_multiplier,
            route_name=d.route.name if d.route else None,
            created_at=d.created_at,
        ))
    return result


@router.post("/demands", response_model=schemas.DemandOut, status_code=201)
def create_demand(body: schemas.DemandCreate, db: Session = Depends(get_db)):
    route = db.get(models.Route, body.route_id)
    if not route:
        raise HTTPException(404, f"Route {body.route_id} not found")
    obj = models.PassengerDemand(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return schemas.DemandOut(
        **obj.__dict__,
        route_name=route.name,
    )


@router.put("/demands/{demand_id}", response_model=schemas.DemandOut)
def update_demand(demand_id: int, body: schemas.DemandUpdate, db: Session = Depends(get_db)):
    obj = db.get(models.PassengerDemand, demand_id)
    if not obj:
        raise HTTPException(404, "Demand record not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return schemas.DemandOut(
        **obj.__dict__,
        route_name=obj.route.name if obj.route else None,
    )


@router.delete("/demands/{demand_id}")
def delete_demand(demand_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.PassengerDemand, demand_id)
    if not obj:
        raise HTTPException(404, "Demand record not found")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ── CSV Exports ───────────────────────────────────────────────
@router.get("/export/buses")
def export_buses_csv(db: Session = Depends(get_db)):
    buses = db.query(models.Bus).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "number", "capacity", "fuel_type", "operating_cost_per_km", "is_available"])
    for b in buses:
        w.writerow([b.id, b.number, b.capacity, b.fuel_type, b.operating_cost_per_km, b.is_available])
    buf.seek(0)
    return StreamingResponse(iter([buf.read()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=buses.csv"})


@router.get("/export/demands")
def export_demands_csv(db: Session = Depends(get_db)):
    demands = db.query(models.PassengerDemand).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "route_id", "route_name", "time_slot", "passengers", "peak_multiplier"])
    for d in demands:
        w.writerow([d.id, d.route_id, d.route.name if d.route else "", d.time_slot, d.passengers, d.peak_multiplier])
    buf.seek(0)
    return StreamingResponse(iter([buf.read()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=demands.csv"})
