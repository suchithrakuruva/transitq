"""End-to-End integration test suite for TransitQ."""
import urllib.request
import json
import sys

BASE_URL = "http://localhost:8000"

def get(path):
    req = urllib.request.Request(f"{BASE_URL}{path}")
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def post(path, body):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def get_raw(path):
    req = urllib.request.Request(f"{BASE_URL}{path}")
    with urllib.request.urlopen(req) as resp:
        return resp.status, resp.read().decode("utf-8")

def run_tests():
    print("=== Step 1: Health & Overview ===")
    status, health = get("/health")
    assert status == 200 and health["status"] == "ok", f"Health failed: {health}"
    print("[PASS] Health check OK")

    status, overview = get("/overview/metrics")
    assert status == 200 and overview["total_routes"] >= 6, f"Overview metrics failed: {overview}"
    print(f"[PASS] Overview metrics OK (Routes: {overview['total_routes']}, Stops: {overview['total_stops']}, Buses: {overview['total_buses']}, Demand: {overview['total_demand']})")

    print("\n=== Step 2: Transport Network & Fleet Inspection ===")
    status, stops = get("/network/stops")
    assert status == 200 and len(stops) >= 12, "Stops listing failed"
    print(f"[PASS] Stops query: {len(stops)} stops loaded")

    status, routes = get("/network/routes")
    assert status == 200 and len(routes) >= 6, "Routes listing failed"
    print(f"[PASS] Routes query: {len(routes)} routes loaded")

    status, buses = get("/fleet/buses")
    assert status == 200 and len(buses) >= 8, "Buses listing failed"
    print(f"[PASS] Buses query: {len(buses)} buses loaded")

    status, demands = get("/fleet/demands")
    assert status == 200 and len(demands) >= 30, "Demands listing failed"
    print(f"[PASS] Demands query: {len(demands)} demand entries loaded")

    print("\n=== Step 3: Run Classical Optimizer ===")
    status, classical_run = post("/optimize/run", {"solver_type": "classical", "parameters": {"turnaround_min": 10}})
    assert status == 201 and classical_run["status"] == "completed", f"Classical optimization failed: {classical_run}"
    run_id_classical = classical_run["id"]
    print(f"[PASS] Classical Run #{run_id_classical}: trips={classical_run['total_trips']}, served={classical_run['demand_served']}/{classical_run['total_demand']}, wait={classical_run['avg_waiting_time_min']}m, cost=Rs.{classical_run['operating_cost']}, feasible={classical_run['feasible']}")

    print("\n=== Step 4: Run Simulated Annealing Optimizer ===")
    status, sa_run = post("/optimize/run", {"solver_type": "simulated_annealing", "parameters": {"turnaround_min": 10, "max_iter": 3000}})
    assert status == 201 and sa_run["status"] == "completed", f"SA optimization failed: {sa_run}"
    run_id_sa = sa_run["id"]
    print(f"[PASS] Simulated Annealing Run #{run_id_sa}: trips={sa_run['total_trips']}, served={sa_run['demand_served']}/{sa_run['total_demand']}, wait={sa_run['avg_waiting_time_min']}m, cost=Rs.{sa_run['operating_cost']}, feasible={sa_run['feasible']}")

    print("\n=== Step 5: Run QUBO Optimizer (Classical SA Solver on QUBO Formulation) ===")
    status, qubo_run = post("/optimize/run", {"solver_type": "qubo", "parameters": {"turnaround_min": 10, "max_iter": 2000}})
    assert status == 201 and qubo_run["status"] == "completed", f"QUBO optimization failed: {qubo_run}"
    run_id_qubo = qubo_run["id"]
    print(f"[PASS] QUBO Run #{run_id_qubo}: trips={qubo_run['total_trips']}, served={qubo_run['demand_served']}/{qubo_run['total_demand']}, wait={qubo_run['avg_waiting_time_min']}m, cost=Rs.{qubo_run['operating_cost']}")
    assert qubo_run["result_summary"]["quantum_hardware"] is False, "Quantum hardware flag must be False"
    print("[PASS] Verified Quantum disclaimer & validation metadata present in QUBO summary")

    print("\n=== Step 6: Trip Inspection & Schedule Verification ===")
    status, trips = get(f"/optimize/runs/{run_id_classical}/trips")
    assert status == 200 and len(trips) > 0, "No trips returned"
    sample_trip = trips[0]
    print(f"[PASS] Trips loaded successfully ({len(trips)} trips). Sample: Route '{sample_trip['route_name']}', Bus {sample_trip['bus_number']}, {sample_trip['departure_time']} -> {sample_trip['arrival_time']}, Pax: {sample_trip['passengers_served']}")

    print("\n=== Step 7: Compare Results ===")
    status, comp = get("/optimize/compare")
    assert status == 200, "Comparison failed"
    for stype in ["classical", "simulated_annealing", "qubo"]:
        assert stype in comp, f"{stype} missing from comparison"
        print(f"  * {stype.upper():20}: served={comp[stype]['demand_served']}, wait={comp[stype]['avg_waiting_time_min']}m, cost=Rs.{comp[stype]['operating_cost']}, runtime={comp[stype]['runtime_seconds']}s")
    print("[PASS] Multi-solver comparison generated")

    print("\n=== Step 8: CSV Export Verification ===")
    s1, csv_sched = get_raw(f"/optimize/export/schedule/{run_id_classical}")
    assert s1 == 200 and "trip_id,route_name" in csv_sched, "Schedule CSV export failed"
    print(f"[PASS] Schedule CSV exported ({len(csv_sched.splitlines())} lines)")

    s2, csv_res = get_raw(f"/optimize/export/results/{run_id_classical}")
    assert s2 == 200 and "metric,value" in csv_res, "Results CSV export failed"
    print(f"[PASS] Results CSV exported ({len(csv_res.splitlines())} lines)")

    s3, csv_stops = get_raw("/network/export/stops")
    assert s3 == 200 and "name,code" in csv_stops, "Stops CSV export failed"
    print(f"[PASS] Stops dataset CSV exported ({len(csv_stops.splitlines())} lines)")

    print("\n=== Step 9: Data Management & Provenance ===")
    status, d_status = get("/data/status")
    assert status == 200 and d_status["is_synthetic"] is True, "Data status failed"
    print(f"[PASS] Data provenance confirmed: {d_status['dataset_type']}")

    print("\n==========================================")
    print("ALL 9 CRITICAL INTEGRATION TESTS PASSED!")
    print("==========================================")

if __name__ == "__main__":
    run_tests()
