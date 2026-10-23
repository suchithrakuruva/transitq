"""TransitQ FastAPI application entry point."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import APP_TITLE, APP_VERSION, CORS_ORIGINS, DEBUG
from .models import Base, engine, SessionLocal
from .seed import seed_demo_data
from .routers import network, fleet, optimizer, overview, data_mgmt


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables
    Base.metadata.create_all(bind=engine)
    # Seed demo data if empty
    db = SessionLocal()
    try:
        seeded = seed_demo_data(db)
        if seeded:
            print("[TransitQ] Demo data seeded (SYNTHETIC - not verified GPREC data)")
        else:
            print("[TransitQ] Database already populated")
    finally:
        db.close()
    yield


app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description=(
        "TransitQ – Public Transport Network Optimizer for GPREC. "
        "Built for QAIC 2027 hackathon. "
        "⚠ Demo data is SYNTHETIC and not verified GPREC operational data."
    ),
    debug=DEBUG,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(overview.router)
app.include_router(network.router)
app.include_router(fleet.router)
app.include_router(optimizer.router)
app.include_router(data_mgmt.router)


@app.get("/health")
def health():
    return {"status": "ok", "app": APP_TITLE, "version": APP_VERSION}
