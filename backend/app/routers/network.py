"""Stops & Connections router."""
import io
import csv
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from .. import models, schemas
from ..models import get_db

router = APIRouter(prefix="/network", tags=["network"])


# ── Stops ─────────────────────────────────────────────────────
@router.get("/stops", response_model=List[schemas.StopOut])
def list_stops(db: Session = Depends(get_db)):
    return db.query(models.Stop).all()


@router.post("/stops", response_model=schemas.StopOut, status_code=201)
def create_stop(body: schemas.StopCreate, db: Session = Depends(get_db)):
    if db.query(models.Stop).filter(models.Stop.code == body.code).first():
        raise HTTPException(400, f"Stop code '{body.code}' already exists")
    obj = models.Stop(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/stops/{stop_id}", response_model=schemas.StopOut)
def update_stop(stop_id: int, body: schemas.StopUpdate, db: Session = Depends(get_db)):
    obj = db.get(models.Stop, stop_id)
    if not obj:
        raise HTTPException(404, "Stop not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/stops/{stop_id}")
def delete_stop(stop_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.Stop, stop_id)
    if not obj:
        raise HTTPException(404, "Stop not found")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ── Connections ───────────────────────────────────────────────
@router.get("/connections", response_model=List[schemas.ConnectionOut])
def list_connections(db: Session = Depends(get_db)):
    conns = db.query(models.Connection).all()
    result = []
    for c in conns:
        result.append(schemas.ConnectionOut(
            id=c.id,
            from_stop_id=c.from_stop_id,
            to_stop_id=c.to_stop_id,
            distance_km=c.distance_km,
            travel_time_min=c.travel_time_min,
            is_bidirectional=c.is_bidirectional,
            from_stop_name=c.from_stop.name if c.from_stop else None,
            to_stop_name=c.to_stop.name if c.to_stop else None,
            created_at=c.created_at,
        ))
    return result


@router.post("/connections", response_model=schemas.ConnectionOut, status_code=201)
def create_connection(body: schemas.ConnectionCreate, db: Session = Depends(get_db)):
    for sid in [body.from_stop_id, body.to_stop_id]:
        if not db.get(models.Stop, sid):
            raise HTTPException(404, f"Stop {sid} not found")
    obj = models.Connection(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return schemas.ConnectionOut(
        **obj.__dict__,
        from_stop_name=obj.from_stop.name if obj.from_stop else None,
        to_stop_name=obj.to_stop.name if obj.to_stop else None,
    )


@router.delete("/connections/{conn_id}")
def delete_connection(conn_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.Connection, conn_id)
    if not obj:
        raise HTTPException(404, "Connection not found")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ── Routes ────────────────────────────────────────────────────
@router.get("/routes", response_model=List[schemas.RouteOut])
def list_routes(db: Session = Depends(get_db)):
    return db.query(models.Route).all()


@router.post("/routes", response_model=schemas.RouteOut, status_code=201)
def create_route(body: schemas.RouteCreate, db: Session = Depends(get_db)):
    if db.query(models.Route).filter(models.Route.code == body.code).first():
        raise HTTPException(400, f"Route code '{body.code}' already exists")
    for sid in body.stop_sequence:
        if not db.get(models.Stop, sid):
            raise HTTPException(404, f"Stop {sid} not found")
    obj = models.Route(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/routes/{route_id}", response_model=schemas.RouteOut)
def update_route(route_id: int, body: schemas.RouteUpdate, db: Session = Depends(get_db)):
    obj = db.get(models.Route, route_id)
    if not obj:
        raise HTTPException(404, "Route not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/routes/{route_id}")
def delete_route(route_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.Route, route_id)
    if not obj:
        raise HTTPException(404, "Route not found")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ── CSV Export ────────────────────────────────────────────────
@router.get("/export/stops")
def export_stops_csv(db: Session = Depends(get_db)):
    stops = db.query(models.Stop).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "name", "code", "latitude", "longitude", "is_terminal", "description"])
    for s in stops:
        w.writerow([s.id, s.name, s.code, s.latitude, s.longitude, s.is_terminal, s.description])
    buf.seek(0)
    return StreamingResponse(iter([buf.read()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=stops.csv"})


@router.get("/export/routes")
def export_routes_csv(db: Session = Depends(get_db)):
    routes = db.query(models.Route).all()
    stop_map = {s.id: s.name for s in db.query(models.Stop).all()}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "name", "code", "stop_sequence_names", "total_distance_km", "estimated_duration_min"])
    for r in routes:
        names = " -> ".join([stop_map.get(sid, str(sid)) for sid in (r.stop_sequence or [])])
        w.writerow([r.id, r.name, r.code, names, r.total_distance_km, r.estimated_duration_min])
    buf.seek(0)
    return StreamingResponse(iter([buf.read()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=routes.csv"})
