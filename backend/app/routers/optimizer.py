"""Optimizer & Solver runs router."""
import io
import csv
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from .. import models, schemas
from ..models import get_db
from ..solver import BusSpec, RouteSpec, DemandSlot, run_solver

router = APIRouter(prefix="/optimize", tags=["optimize"])


def _load_solver_inputs(db: Session):
    routes = [
        RouteSpec(
            id=r.id, code=r.code,
            duration_min=r.estimated_duration_min or 30,
            distance_km=r.total_distance_km or 1,
            stop_sequence=r.stop_sequence or [],
        )
        for r in db.query(models.Route).filter(models.Route.is_active == True).all()
    ]
    buses = [
        BusSpec(id=b.id, number=b.number, capacity=b.capacity, cost_per_km=b.operating_cost_per_km)
        for b in db.query(models.Bus).filter(models.Bus.is_available == True).all()
    ]
    demands = [
        DemandSlot(route_id=d.route_id, time_slot=d.time_slot, passengers=d.passengers, peak_multiplier=d.peak_multiplier)
        for d in db.query(models.PassengerDemand).all()
        if db.get(models.Route, d.route_id) and db.get(models.Route, d.route_id).is_active
    ]
    return routes, buses, demands


@router.post("/run", response_model=schemas.SolverRunOut, status_code=201)
def run_optimization(body: schemas.SolverRequest, db: Session = Depends(get_db)):
    routes, buses, demands = _load_solver_inputs(db)
    if not routes:
        raise HTTPException(400, "No active routes found. Add routes before optimizing.")
    if not buses:
        raise HTTPException(400, "No available buses found. Add buses before optimizing.")
    if not demands:
        raise HTTPException(400, "No passenger demand data found. Add demand records first.")

    # Create a run record
    run = models.SolverRun(solver_type=body.solver_type, status="running", parameters=body.parameters)
    db.add(run)
    db.commit()
    db.refresh(run)

    try:
        result = run_solver(body.solver_type, routes, buses, demands, body.parameters)
    except Exception as exc:
        run.status = "failed"
        run.result_summary = {"error": str(exc)}
        db.commit()
        raise HTTPException(500, f"Solver error: {exc}")

    # Persist trips
    for t in result.trips:
        trip = models.ScheduledTrip(
            route_id=t.route_id,
            bus_id=t.bus_id,
            departure_time=t.departure_time,
            arrival_time=t.arrival_time,
            passengers_served=t.passengers_served,
            status="scheduled",
            solver_run_id=run.id,
        )
        db.add(trip)

    run.status = "completed"
    run.runtime_seconds = result.runtime_seconds
    run.total_trips = len(result.trips)
    run.demand_served = result.demand_served
    run.total_demand = result.total_demand
    run.avg_waiting_time_min = result.avg_waiting_time_min
    run.operating_cost = result.operating_cost
    run.vehicle_utilization = result.vehicle_utilization
    run.feasible = result.feasible
    run.result_summary = result.metadata
    db.commit()
    db.refresh(run)
    return run


@router.get("/runs", response_model=List[schemas.SolverRunOut])
def list_runs(db: Session = Depends(get_db)):
    return db.query(models.SolverRun).order_by(models.SolverRun.created_at.desc()).all()


@router.get("/runs/{run_id}", response_model=schemas.SolverRunOut)
def get_run(run_id: int, db: Session = Depends(get_db)):
    run = db.get(models.SolverRun, run_id)
    if not run:
        raise HTTPException(404, "Solver run not found")
    return run


@router.get("/runs/{run_id}/trips", response_model=List[schemas.TripOut])
def get_run_trips(run_id: int, db: Session = Depends(get_db)):
    run = db.get(models.SolverRun, run_id)
    if not run:
        raise HTTPException(404, "Solver run not found")
    trips = db.query(models.ScheduledTrip).filter(models.ScheduledTrip.solver_run_id == run_id).all()
    result = []
    for t in trips:
        result.append(schemas.TripOut(
            id=t.id,
            route_id=t.route_id,
            bus_id=t.bus_id,
            departure_time=t.departure_time,
            arrival_time=t.arrival_time,
            passengers_served=t.passengers_served,
            status=t.status,
            route_name=t.route.name if t.route else None,
            bus_number=t.bus.number if t.bus else None,
            solver_run_id=t.solver_run_id,
            created_at=t.created_at,
        ))
    return result


@router.get("/compare")
def compare_runs(db: Session = Depends(get_db)):
    """Return the latest run of each solver type for comparison."""
    results = {}
    for solver_type in ["classical", "simulated_annealing", "qubo"]:
        run = (
            db.query(models.SolverRun)
            .filter(models.SolverRun.solver_type == solver_type, models.SolverRun.status == "completed")
            .order_by(models.SolverRun.created_at.desc())
            .first()
        )
        if run:
            results[solver_type] = {
                "id": run.id,
                "runtime_seconds": run.runtime_seconds,
                "demand_served": run.demand_served,
                "total_demand": run.total_demand,
                "avg_waiting_time_min": run.avg_waiting_time_min,
                "operating_cost": run.operating_cost,
                "vehicle_utilization": run.vehicle_utilization,
                "feasible": run.feasible,
                "total_trips": run.total_trips,
                "created_at": run.created_at.isoformat(),
            }
    return results


@router.get("/export/schedule/{run_id}")
def export_schedule_csv(run_id: int, db: Session = Depends(get_db)):
    run = db.get(models.SolverRun, run_id)
    if not run:
        raise HTTPException(404, "Solver run not found")
    trips = db.query(models.ScheduledTrip).filter(models.ScheduledTrip.solver_run_id == run_id).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["trip_id", "route_name", "route_code", "bus_number", "departure_time", "arrival_time",
                "passengers_served", "status", "solver_type"])
    for t in trips:
        w.writerow([
            t.id,
            t.route.name if t.route else "",
            t.route.code if t.route else "",
            t.bus.number if t.bus else "",
            t.departure_time,
            t.arrival_time,
            t.passengers_served,
            t.status,
            run.solver_type,
        ])
    buf.seek(0)
    return StreamingResponse(iter([buf.read()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename=schedule_run_{run_id}.csv"})


@router.get("/export/results/{run_id}")
def export_results_csv(run_id: int, db: Session = Depends(get_db)):
    run = db.get(models.SolverRun, run_id)
    if not run:
        raise HTTPException(404, "Solver run not found")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["metric", "value"])
    w.writerow(["solver_type", run.solver_type])
    w.writerow(["status", run.status])
    w.writerow(["runtime_seconds", run.runtime_seconds])
    w.writerow(["total_trips", run.total_trips])
    w.writerow(["demand_served", run.demand_served])
    w.writerow(["total_demand", run.total_demand])
    demand_pct = round(run.demand_served / run.total_demand * 100, 1) if run.total_demand else 0
    w.writerow(["demand_served_pct", demand_pct])
    w.writerow(["avg_waiting_time_min", run.avg_waiting_time_min])
    w.writerow(["operating_cost_inr", run.operating_cost])
    w.writerow(["vehicle_utilization", run.vehicle_utilization])
    w.writerow(["feasible", run.feasible])
    w.writerow(["created_at", run.created_at.isoformat()])
    buf.seek(0)
    return StreamingResponse(iter([buf.read()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename=results_run_{run_id}.csv"})
