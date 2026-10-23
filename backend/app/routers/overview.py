"""Overview/metrics router."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import models, schemas
from ..models import get_db

router = APIRouter(prefix="/overview", tags=["overview"])


@router.get("/metrics", response_model=schemas.OverviewMetrics)
def get_overview(db: Session = Depends(get_db)):
    total_demand = sum(d.passengers for d in db.query(models.PassengerDemand).all())
    latest_run = (
        db.query(models.SolverRun)
        .filter(models.SolverRun.status == "completed")
        .order_by(models.SolverRun.created_at.desc())
        .first()
    )
    return schemas.OverviewMetrics(
        total_routes=db.query(models.Route).count(),
        total_stops=db.query(models.Stop).count(),
        total_buses=db.query(models.Bus).count(),
        available_buses=db.query(models.Bus).filter(models.Bus.is_available == True).count(),
        total_demand=total_demand,
        latest_run_id=latest_run.id if latest_run else None,
        latest_avg_waiting_time=latest_run.avg_waiting_time_min if latest_run else None,
        latest_demand_served=latest_run.demand_served if latest_run else None,
        latest_vehicle_utilization=latest_run.vehicle_utilization if latest_run else None,
        latest_operating_cost=latest_run.operating_cost if latest_run else None,
        latest_feasible=latest_run.feasible if latest_run else None,
        solver_runs_count=db.query(models.SolverRun).count(),
    )
