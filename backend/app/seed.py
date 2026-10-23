"""Sample GPREC campus data seeder – clearly labeled as SYNTHETIC demo data."""
from sqlalchemy.orm import Session
from .models import Stop, Connection, Route, Bus, PassengerDemand


# NOTE: The stop coordinates, route times, and demand numbers below are
# SYNTHETIC / ILLUSTRATIVE data created for the QAIC 2027 hackathon demo.
# They are NOT verified GPREC operational data.

DEMO_STOPS = [
    {"name": "GPREC Main Gate",        "code": "GMG",  "lat": 15.8320, "lon": 78.0520, "is_terminal": True,  "desc": "Main entrance – Nandyal Road"},
    {"name": "GPREC Admin Block",       "code": "GAB",  "lat": 15.8325, "lon": 78.0530, "is_terminal": False, "desc": "Administrative building"},
    {"name": "Boys Hostel Block-A",     "code": "BHA",  "lat": 15.8315, "lon": 78.0545, "is_terminal": False, "desc": "Men's residential block A"},
    {"name": "Girls Hostel Block",      "code": "GHB",  "lat": 15.8308, "lon": 78.0538, "is_terminal": False, "desc": "Women's residential block"},
    {"name": "Central Library",         "code": "CLB",  "lat": 15.8330, "lon": 78.0555, "is_terminal": False, "desc": "Main campus library"},
    {"name": "Academic Block-I",        "code": "AB1",  "lat": 15.8340, "lon": 78.0548, "is_terminal": False, "desc": "CSE/ECE departments"},
    {"name": "Academic Block-II",       "code": "AB2",  "lat": 15.8345, "lon": 78.0560, "is_terminal": False, "desc": "Mech/Civil departments"},
    {"name": "Nandyal Bus Stand",       "code": "NBS",  "lat": 15.4792, "lon": 78.4833, "is_terminal": True,  "desc": "Nandyal city bus terminal"},
    {"name": "Kurnool Bus Stand",       "code": "KBS",  "lat": 15.8281, "lon": 78.0370, "is_terminal": True,  "desc": "Kurnool city APSRTC stand"},
    {"name": "Flyover Junction",        "code": "FLJ",  "lat": 15.8290, "lon": 78.0450, "is_terminal": False, "desc": "Highway flyover interchange"},
    {"name": "Sports Complex",          "code": "SPC",  "lat": 15.8350, "lon": 78.0570, "is_terminal": False, "desc": "Campus sports facility"},
    {"name": "Canteen / Food Court",    "code": "CFC",  "lat": 15.8332, "lon": 78.0540, "is_terminal": False, "desc": "Central dining area"},
]

DEMO_CONNECTIONS = [
    # from_code, to_code, dist_km, time_min
    ("GMG", "GAB",  0.3,  3),
    ("GAB", "AB1",  0.6,  5),
    ("AB1", "AB2",  0.3,  3),
    ("AB1", "CLB",  0.4,  4),
    ("CLB", "CFC",  0.2,  2),
    ("GAB", "BHA",  0.5,  5),
    ("GAB", "GHB",  0.4,  4),
    ("GHB", "CLB",  0.3,  3),
    ("AB2", "SPC",  0.4,  4),
    ("GMG", "FLJ",  2.5, 10),
    ("FLJ", "KBS", 10.0, 30),
    ("FLJ", "NBS", 60.0, 90),
    ("GMG", "KBS", 12.0, 35),
    ("BHA", "CFC",  0.3,  3),
]

DEMO_ROUTES = [
    {
        "name": "Campus Circular – Morning",
        "code": "CC-AM",
        "stops": ["GMG", "GAB", "BHA", "GHB", "CLB", "CFC", "AB1", "AB2", "SPC", "GMG"],
        "dist_km": 3.5,
        "dur_min": 30,
    },
    {
        "name": "Campus Circular – Afternoon",
        "code": "CC-PM",
        "stops": ["GMG", "SPC", "AB2", "AB1", "CFC", "CLB", "GHB", "BHA", "GAB", "GMG"],
        "dist_km": 3.5,
        "dur_min": 30,
    },
    {
        "name": "GPREC – Kurnool Express",
        "code": "GK-EX",
        "stops": ["GMG", "FLJ", "KBS"],
        "dist_km": 12.5,
        "dur_min": 40,
    },
    {
        "name": "GPREC – Nandyal Link",
        "code": "GN-LK",
        "stops": ["GMG", "FLJ", "NBS"],
        "dist_km": 62.0,
        "dur_min": 100,
    },
    {
        "name": "Hostel Shuttle – Morning",
        "code": "HS-AM",
        "stops": ["BHA", "GHB", "GAB", "AB1"],
        "dist_km": 1.4,
        "dur_min": 12,
    },
    {
        "name": "Hostel Shuttle – Evening",
        "code": "HS-PM",
        "stops": ["AB1", "GAB", "GHB", "BHA"],
        "dist_km": 1.4,
        "dur_min": 12,
    },
]

DEMO_BUSES = [
    {"number": "AP-09-TC-1001", "capacity": 50, "fuel": "Diesel",     "cost": 12.0},
    {"number": "AP-09-TC-1002", "capacity": 50, "fuel": "Diesel",     "cost": 12.0},
    {"number": "AP-09-TC-1003", "capacity": 40, "fuel": "Diesel",     "cost": 11.5},
    {"number": "AP-09-TC-1004", "capacity": 40, "fuel": "Diesel",     "cost": 11.5},
    {"number": "AP-09-TC-1005", "capacity": 30, "fuel": "CNG",        "cost": 9.0},
    {"number": "AP-09-TC-1006", "capacity": 30, "fuel": "CNG",        "cost": 9.0},
    {"number": "AP-09-TC-1007", "capacity": 60, "fuel": "Diesel",     "cost": 13.0},
    {"number": "AP-09-TC-1008", "capacity": 25, "fuel": "Electric",   "cost": 6.5},
]

# Synthetic demand profile: (route_code, time_slot, passengers, peak_mult)
DEMO_DEMAND = [
    # Morning peak
    ("CC-AM", "06:00", 30, 1.0), ("CC-AM", "07:00", 50, 1.5), ("CC-AM", "08:00", 60, 2.0),
    ("CC-AM", "09:00", 45, 1.3), ("CC-AM", "10:00", 25, 1.0), ("CC-AM", "11:00", 20, 1.0),
    ("CC-AM", "12:00", 35, 1.2), ("CC-AM", "13:00", 28, 1.0), ("CC-AM", "14:00", 22, 1.0),
    ("CC-AM", "15:00", 30, 1.1), ("CC-AM", "16:00", 40, 1.4), ("CC-AM", "17:00", 55, 1.8),
    ("CC-AM", "18:00", 48, 1.5), ("CC-AM", "19:00", 20, 1.0),

    ("CC-PM", "13:00", 30, 1.0), ("CC-PM", "14:00", 25, 1.0), ("CC-PM", "15:00", 35, 1.2),
    ("CC-PM", "16:00", 45, 1.5), ("CC-PM", "17:00", 55, 1.8), ("CC-PM", "18:00", 40, 1.4),

    ("GK-EX", "06:30", 35, 1.2), ("GK-EX", "07:30", 48, 1.5), ("GK-EX", "08:30", 40, 1.3),
    ("GK-EX", "14:00", 30, 1.0), ("GK-EX", "17:00", 50, 1.6), ("GK-EX", "18:00", 45, 1.5),

    ("GN-LK", "06:00", 20, 1.0), ("GN-LK", "07:00", 35, 1.2), ("GN-LK", "17:00", 30, 1.1),
    ("GN-LK", "18:00", 25, 1.0),

    ("HS-AM", "06:00", 20, 1.0), ("HS-AM", "07:00", 35, 1.5), ("HS-AM", "08:00", 40, 1.8),
    ("HS-AM", "09:00", 20, 1.0),

    ("HS-PM", "16:00", 25, 1.2), ("HS-PM", "17:00", 40, 1.6), ("HS-PM", "18:00", 35, 1.4),
    ("HS-PM", "19:00", 15, 1.0),
]


def seed_demo_data(db: Session) -> bool:
    """Insert synthetic demo data if the DB is empty. Returns True if seeded."""
    if db.query(Stop).count() > 0:
        return False   # already seeded

    # Stops
    stop_objs: dict[str, Stop] = {}
    for s in DEMO_STOPS:
        obj = Stop(
            name=s["name"], code=s["code"],
            latitude=s["lat"], longitude=s["lon"],
            is_terminal=s["is_terminal"], description=s["desc"],
        )
        db.add(obj)
        stop_objs[s["code"]] = obj
    db.flush()

    # Connections
    code_to_stop = {c: stop_objs[c] for c in stop_objs}
    for fc, tc, dist, ttime in DEMO_CONNECTIONS:
        conn = Connection(
            from_stop_id=code_to_stop[fc].id,
            to_stop_id=code_to_stop[tc].id,
            distance_km=dist,
            travel_time_min=ttime,
            is_bidirectional=True,
        )
        db.add(conn)
    db.flush()

    # Routes
    route_objs: dict[str, Route] = {}
    for r in DEMO_ROUTES:
        stop_ids = [code_to_stop[c].id for c in r["stops"] if c in code_to_stop]
        obj = Route(
            name=r["name"], code=r["code"],
            stop_sequence=stop_ids,
            total_distance_km=r["dist_km"],
            estimated_duration_min=r["dur_min"],
        )
        db.add(obj)
        route_objs[r["code"]] = obj
    db.flush()

    # Buses
    main_gate = stop_objs.get("GMG")
    for b in DEMO_BUSES:
        obj = Bus(
            number=b["number"], capacity=b["capacity"],
            fuel_type=b["fuel"], operating_cost_per_km=b["cost"],
            depot_stop_id=main_gate.id if main_gate else None,
            is_available=True,
        )
        db.add(obj)
    db.flush()

    # Demand
    for rc, slot, pax, mult in DEMO_DEMAND:
        route = route_objs.get(rc)
        if not route:
            continue
        obj = PassengerDemand(
            route_id=route.id,
            time_slot=slot,
            passengers=pax,
            peak_multiplier=mult,
        )
        db.add(obj)

    db.commit()
    return True
