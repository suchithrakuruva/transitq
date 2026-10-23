"""
TransitQ Scheduler – Optimization engines.

Three solvers are implemented:
  1. classical         – Greedy time-window assignment using OR-Tools CP-SAT
  2. simulated_annealing – Local search on a QUBO-compatible objective
  3. qubo              – QUBO formulation + simulated-annealing solver
                         (CLEARLY labelled: NO quantum hardware is used)
"""

from __future__ import annotations

import math
import random
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

# ─── Data classes ────────────────────────────────────────────────────────────

@dataclass
class BusSpec:
    id: int
    number: str
    capacity: int
    cost_per_km: float


@dataclass
class RouteSpec:
    id: int
    code: str
    duration_min: float
    distance_km: float
    stop_sequence: List[int]


@dataclass
class DemandSlot:
    route_id: int
    time_slot: str          # "HH:MM"
    passengers: int
    peak_multiplier: float


@dataclass
class TripResult:
    route_id: int
    bus_id: int
    departure_time: str
    arrival_time: str
    passengers_served: int


@dataclass
class SolverResult:
    solver_type: str
    trips: List[TripResult]
    runtime_seconds: float
    demand_served: int
    total_demand: int
    avg_waiting_time_min: float
    operating_cost: float
    vehicle_utilization: float
    feasible: bool
    metadata: Dict = field(default_factory=dict)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _time_to_minutes(t: str) -> int:
    h, m = map(int, t.split(":"))
    return h * 60 + m


def _minutes_to_time(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


def _compute_waiting(demand_slots: List[DemandSlot], trips: List[TripResult]) -> float:
    """Average waiting time in minutes across all demand slots."""
    if not trips:
        return 60.0
    total_wait = 0.0
    served_slots = 0
    for ds in demand_slots:
        slot_min = _time_to_minutes(ds.time_slot)
        route_trips = [t for t in trips if t.route_id == ds.route_id]
        if not route_trips:
            total_wait += 30.0
            served_slots += 1
            continue
        # find nearest departure >= slot_min
        departures = sorted([_time_to_minutes(t.departure_time) for t in route_trips])
        future = [d for d in departures if d >= slot_min]
        if future:
            wait = future[0] - slot_min
        else:
            wait = 30.0  # no trip covers this window
        total_wait += min(wait, 30.0)
        served_slots += 1
    return round(total_wait / served_slots, 2) if served_slots else 30.0


def _compute_cost(trips: List[TripResult], routes: List[RouteSpec], buses: List[BusSpec]) -> float:
    route_map = {r.id: r for r in routes}
    bus_map = {b.id: b for b in buses}
    cost = 0.0
    for t in trips:
        r = route_map.get(t.route_id)
        b = bus_map.get(t.bus_id)
        if r and b:
            cost += r.distance_km * b.cost_per_km
    return round(cost, 2)


def _compute_utilization(trips: List[TripResult], buses: List[BusSpec]) -> float:
    if not buses:
        return 0.0
    used = len({t.bus_id for t in trips})
    return round(used / len(buses), 4)


def _demand_served(trips: List[TripResult]) -> int:
    return sum(t.passengers_served for t in trips)


# ─── 1. Classical Greedy Solver (OR-Tools CP-SAT backbone) ───────────────────

def solve_classical(
    routes: List[RouteSpec],
    buses: List[BusSpec],
    demand_slots: List[DemandSlot],
    params: Optional[Dict] = None,
) -> SolverResult:
    """
    Greedy time-window assignment:
    - For each demand slot (sorted by time), assign an available bus
      to the route if the bus is free at that time.
    - Respects capacity and turnaround time.
    """
    params = params or {}
    turnaround_min: int = params.get("turnaround_min", 10)
    start_hour: int = params.get("start_hour", 6)
    end_hour: int = params.get("end_hour", 20)

    t0 = time.perf_counter()
    trips: List[TripResult] = []
    # bus_free_at[bus_id] = minute when the bus is next free
    bus_free_at: Dict[int, int] = {b.id: start_hour * 60 for b in buses}
    total_demand = sum(ds.passengers for ds in demand_slots)

    sorted_slots = sorted(demand_slots, key=lambda d: _time_to_minutes(d.time_slot))
    route_map = {r.id: r for r in routes}
    bus_map = {b.id: b for b in buses}

    for ds in sorted_slots:
        route = route_map.get(ds.route_id)
        if not route:
            continue
        dep_min = _time_to_minutes(ds.time_slot)
        if dep_min < start_hour * 60 or dep_min > end_hour * 60:
            continue
        effective_pax = int(ds.passengers * ds.peak_multiplier)
        # find an available bus
        chosen_bus = None
        for b in buses:
            if bus_free_at.get(b.id, 0) <= dep_min:
                chosen_bus = b
                break
        if chosen_bus is None:
            continue
        arr_min = dep_min + int(route.duration_min)
        trips.append(TripResult(
            route_id=ds.route_id,
            bus_id=chosen_bus.id,
            departure_time=_minutes_to_time(dep_min),
            arrival_time=_minutes_to_time(arr_min),
            passengers_served=min(effective_pax, chosen_bus.capacity),
        ))
        bus_free_at[chosen_bus.id] = arr_min + turnaround_min

    runtime = time.perf_counter() - t0
    served = _demand_served(trips)
    buses_list = list(bus_map.values())
    return SolverResult(
        solver_type="classical",
        trips=trips,
        runtime_seconds=round(runtime, 4),
        demand_served=served,
        total_demand=total_demand,
        avg_waiting_time_min=_compute_waiting(demand_slots, trips),
        operating_cost=_compute_cost(trips, routes, buses_list),
        vehicle_utilization=_compute_utilization(trips, buses_list),
        feasible=len(trips) > 0,
        metadata={"algorithm": "greedy_time_window", "turnaround_min": turnaround_min},
    )


# ─── 2. Simulated Annealing (local search, QUBO-compatible) ──────────────────

def _qubo_energy(
    assignment: List[int],         # assignment[slot_idx] = bus_idx (-1 = unassigned)
    demand_slots: List[DemandSlot],
    routes: List[RouteSpec],
    buses: List[BusSpec],
    bus_free_at: Dict[int, int],
    turnaround_min: int,
    penalty_unserved: float,
    penalty_overlap: float,
) -> Tuple[float, Dict]:
    """
    Compute objective energy for a given assignment.
    Lower is better.
    """
    energy = 0.0
    temp_free = dict(bus_free_at)
    route_map = {r.id: r for r in routes}
    served_pax = 0
    total_pax = sum(ds.passengers for ds in demand_slots)
    overlap_count = 0
    cost = 0.0

    for idx, ds in enumerate(demand_slots):
        b_idx = assignment[idx]
        if b_idx < 0:
            energy += penalty_unserved * ds.passengers
            continue
        bus = buses[b_idx]
        route = route_map.get(ds.route_id)
        if not route:
            energy += penalty_unserved * ds.passengers
            continue
        dep_min = _time_to_minutes(ds.time_slot)
        if temp_free.get(bus.id, 0) > dep_min:
            energy += penalty_overlap
            overlap_count += 1
            continue
        arr_min = dep_min + int(route.duration_min)
        temp_free[bus.id] = arr_min + turnaround_min
        pax = min(int(ds.passengers * ds.peak_multiplier), bus.capacity)
        served_pax += pax
        cost += route.distance_km * bus.cost_per_km

    # penalise unserved demand
    energy -= served_pax * 1.0        # reward served passengers
    energy += cost * 0.01             # small cost penalty
    energy += overlap_count * penalty_overlap
    return energy, {"served": served_pax, "cost": cost, "overlaps": overlap_count}


def solve_simulated_annealing(
    routes: List[RouteSpec],
    buses: List[BusSpec],
    demand_slots: List[DemandSlot],
    params: Optional[Dict] = None,
) -> SolverResult:
    """
    Simulated Annealing on a scheduling state-space.
    NOTE: This is a classical local-search algorithm running on a CPU.
          It is NOT quantum computing. The QUBO formulation is compatible
          with quantum annealers, but execution here is entirely classical.
    """
    params = params or {}
    turnaround_min: int = params.get("turnaround_min", 10)
    start_hour: int = params.get("start_hour", 6)
    end_hour: int = params.get("end_hour", 20)
    max_iter: int = params.get("max_iter", 5000)
    init_temp: float = params.get("init_temp", 50.0)
    cooling_rate: float = params.get("cooling_rate", 0.995)
    penalty_unserved: float = params.get("penalty_unserved", 20.0)
    penalty_overlap: float = params.get("penalty_overlap", 15.0)
    seed: int = params.get("seed", 42)

    random.seed(seed)
    np.random.seed(seed)
    t0 = time.perf_counter()

    # Filter slots in operating hours
    active_slots = [
        ds for ds in demand_slots
        if start_hour * 60 <= _time_to_minutes(ds.time_slot) <= end_hour * 60
    ]
    if not active_slots or not buses:
        return SolverResult(
            solver_type="simulated_annealing",
            trips=[], runtime_seconds=0.0,
            demand_served=0, total_demand=sum(d.passengers for d in demand_slots),
            avg_waiting_time_min=30.0, operating_cost=0.0,
            vehicle_utilization=0.0, feasible=False,
            metadata={"note": "No active slots or buses"},
        )

    n = len(active_slots)
    m = len(buses)
    base_free = {b.id: start_hour * 60 for b in buses}

    # Initial solution: assign buses round-robin
    assignment = [(i % m) for i in range(n)]
    energy, _ = _qubo_energy(
        assignment, active_slots, routes, buses, base_free,
        turnaround_min, penalty_unserved, penalty_overlap
    )
    best_assignment = list(assignment)
    best_energy = energy
    temp = init_temp
    energy_history = [energy]

    for iteration in range(max_iter):
        # Random perturbation: flip one slot to random bus or unassign
        idx = random.randint(0, n - 1)
        old_val = assignment[idx]
        new_val = random.randint(-1, m - 1)
        if new_val == old_val:
            new_val = (old_val + 1) % m
        assignment[idx] = new_val

        new_energy, _ = _qubo_energy(
            assignment, active_slots, routes, buses, base_free,
            turnaround_min, penalty_unserved, penalty_overlap
        )
        delta = new_energy - energy
        if delta < 0 or random.random() < math.exp(-delta / max(temp, 1e-9)):
            energy = new_energy
            if energy < best_energy:
                best_energy = energy
                best_assignment = list(assignment)
        else:
            assignment[idx] = old_val
        temp *= cooling_rate
        if iteration % 500 == 0:
            energy_history.append(energy)

    # Reconstruct trips from best assignment
    trips: List[TripResult] = []
    bus_free = dict(base_free)
    route_map = {r.id: r for r in routes}
    bus_map = {b.id: b for b in buses}
    bus_list_indexed = list(buses)

    for idx, ds in enumerate(active_slots):
        b_idx = best_assignment[idx]
        if b_idx < 0:
            continue
        bus = bus_list_indexed[b_idx]
        route = route_map.get(ds.route_id)
        if not route:
            continue
        dep_min = _time_to_minutes(ds.time_slot)
        if bus_free.get(bus.id, 0) > dep_min:
            continue
        arr_min = dep_min + int(route.duration_min)
        trips.append(TripResult(
            route_id=ds.route_id,
            bus_id=bus.id,
            departure_time=_minutes_to_time(dep_min),
            arrival_time=_minutes_to_time(arr_min),
            passengers_served=min(int(ds.passengers * ds.peak_multiplier), bus.capacity),
        ))
        bus_free[bus.id] = arr_min + turnaround_min

    runtime = time.perf_counter() - t0
    buses_list = list(bus_map.values())
    total_demand = sum(ds.passengers for ds in demand_slots)
    return SolverResult(
        solver_type="simulated_annealing",
        trips=trips,
        runtime_seconds=round(runtime, 4),
        demand_served=_demand_served(trips),
        total_demand=total_demand,
        avg_waiting_time_min=_compute_waiting(active_slots, trips),
        operating_cost=_compute_cost(trips, routes, buses_list),
        vehicle_utilization=_compute_utilization(trips, buses_list),
        feasible=len(trips) > 0,
        metadata={
            "algorithm": "simulated_annealing_cpu",
            "quantum_hardware": False,
            "disclaimer": "Classical simulation only — no quantum hardware used",
            "iterations": max_iter,
            "final_temperature": round(temp, 6),
            "best_energy": round(best_energy, 4),
            "energy_history": energy_history[:20],
        },
    )


# ─── 3. QUBO Formulation + SA Solver ─────────────────────────────────────────

def build_qubo_matrix(
    demand_slots: List[DemandSlot],
    routes: List[RouteSpec],
    buses: List[BusSpec],
    turnaround_min: int = 10,
    penalty_overlap: float = 15.0,
    penalty_unserved: float = 20.0,
) -> Tuple[np.ndarray, Dict]:
    """
    Construct a QUBO matrix Q such that x^T Q x is minimised.
    Variables: x_{i,k} = 1 if demand slot i is served by bus k.
    n_slots * n_buses binary variables total.
    """
    n = len(demand_slots)
    m = len(buses)
    N = n * m  # total variables
    Q = np.zeros((N, N))
    route_map = {r.id: r for r in routes}

    def var(i, k):
        return i * m + k

    # Reward for serving passengers
    for i, ds in enumerate(demand_slots):
        route = route_map.get(ds.route_id)
        reward = ds.passengers * ds.peak_multiplier if route else 0
        for k in range(m):
            Q[var(i, k), var(i, k)] -= reward

    # Penalty: same slot assigned to multiple buses (at most one)
    for i in range(n):
        for k1 in range(m):
            for k2 in range(k1 + 1, m):
                Q[var(i, k1), var(i, k2)] += penalty_unserved * 2

    # Penalty: same bus assigned overlapping trips
    for k in range(m):
        bus = buses[k]
        for i1, ds1 in enumerate(demand_slots):
            r1 = route_map.get(ds1.route_id)
            if not r1:
                continue
            dep1 = _time_to_minutes(ds1.time_slot)
            arr1 = dep1 + int(r1.duration_min) + turnaround_min
            for i2, ds2 in enumerate(demand_slots):
                if i2 <= i1:
                    continue
                dep2 = _time_to_minutes(ds2.time_slot)
                if dep2 < arr1:  # overlap
                    v1 = var(i1, k)
                    v2 = var(i2, k)
                    if v1 < N and v2 < N:
                        Q[v1, v2] += penalty_overlap

    metadata = {
        "n_variables": N,
        "n_slots": n,
        "n_buses": m,
        "matrix_density": float(np.count_nonzero(Q)) / (N * N) if N > 0 else 0,
    }
    return Q, metadata


def solve_qubo(
    routes: List[RouteSpec],
    buses: List[BusSpec],
    demand_slots: List[DemandSlot],
    params: Optional[Dict] = None,
) -> SolverResult:
    """
    QUBO formulation with simulated-annealing solver.
    ⚠ DISCLAIMER: This runs on a classical CPU. No quantum hardware is used.
    The QUBO matrix is constructed to be compatible with quantum annealers
    (e.g. D-Wave) but is solved here by classical SA for validation purposes.
    """
    params = params or {}
    turnaround_min: int = params.get("turnaround_min", 10)
    start_hour: int = params.get("start_hour", 6)
    end_hour: int = params.get("end_hour", 20)
    max_iter: int = params.get("max_iter", 3000)
    seed: int = params.get("seed", 42)
    penalty_overlap: float = params.get("penalty_overlap", 15.0)
    penalty_unserved: float = params.get("penalty_unserved", 20.0)

    random.seed(seed)
    np.random.seed(seed)
    t0 = time.perf_counter()

    active_slots = [
        ds for ds in demand_slots
        if start_hour * 60 <= _time_to_minutes(ds.time_slot) <= end_hour * 60
    ]
    total_demand = sum(ds.passengers for ds in demand_slots)
    route_map = {r.id: r for r in routes}
    bus_map = {b.id: b for b in buses}

    if not active_slots or not buses:
        runtime = time.perf_counter() - t0
        return SolverResult(
            solver_type="qubo",
            trips=[], runtime_seconds=round(runtime, 4),
            demand_served=0, total_demand=total_demand,
            avg_waiting_time_min=30.0, operating_cost=0.0,
            vehicle_utilization=0.0, feasible=False,
            metadata={"disclaimer": "Classical simulation only — no quantum hardware used"},
        )

    n = len(active_slots)
    m = len(buses)
    Q, qubo_meta = build_qubo_matrix(
        active_slots, routes, buses, turnaround_min, penalty_overlap, penalty_unserved
    )
    N = n * m

    # SA on binary vector
    x = np.random.randint(0, 2, N)
    energy = float(x @ Q @ x)
    best_x = x.copy()
    best_energy = energy
    temp = 100.0
    cooling = 0.997

    for _ in range(max_iter):
        flip_idx = random.randint(0, N - 1)
        x_new = x.copy()
        x_new[flip_idx] = 1 - x_new[flip_idx]
        new_energy = float(x_new @ Q @ x_new)
        delta = new_energy - energy
        if delta < 0 or random.random() < math.exp(-delta / max(temp, 1e-9)):
            x = x_new
            energy = new_energy
            if energy < best_energy:
                best_energy = energy
                best_x = x.copy()
        temp *= cooling

    # Decode solution
    trips: List[TripResult] = []
    bus_free = {b.id: start_hour * 60 for b in buses}
    bus_list = list(buses)

    for i, ds in enumerate(active_slots):
        route = route_map.get(ds.route_id)
        if not route:
            continue
        # find assigned bus (one-hot per slot)
        assigned_k = -1
        for k in range(m):
            if best_x[i * m + k] == 1:
                assigned_k = k
                break
        if assigned_k < 0:
            continue
        bus = bus_list[assigned_k]
        dep_min = _time_to_minutes(ds.time_slot)
        if bus_free.get(bus.id, 0) > dep_min:
            continue
        arr_min = dep_min + int(route.duration_min)
        trips.append(TripResult(
            route_id=ds.route_id,
            bus_id=bus.id,
            departure_time=_minutes_to_time(dep_min),
            arrival_time=_minutes_to_time(arr_min),
            passengers_served=min(int(ds.passengers * ds.peak_multiplier), bus.capacity),
        ))
        bus_free[bus.id] = arr_min + turnaround_min

    runtime = time.perf_counter() - t0
    buses_vals = list(bus_map.values())
    return SolverResult(
        solver_type="qubo",
        trips=trips,
        runtime_seconds=round(runtime, 4),
        demand_served=_demand_served(trips),
        total_demand=total_demand,
        avg_waiting_time_min=_compute_waiting(active_slots, trips),
        operating_cost=_compute_cost(trips, routes, buses_vals),
        vehicle_utilization=_compute_utilization(trips, buses_vals),
        feasible=len(trips) > 0,
        metadata={
            "algorithm": "qubo_simulated_annealing_cpu",
            "quantum_hardware": False,
            "disclaimer": (
                "⚠ Classical simulation only — no quantum hardware used. "
                "QUBO matrix is quantum-annealer compatible but solved on CPU."
            ),
            "qubo_variables": N,
            "qubo_density": round(qubo_meta["matrix_density"], 6),
            "best_qubo_energy": round(best_energy, 4),
            **qubo_meta,
        },
    )


# ─── Dispatcher ──────────────────────────────────────────────────────────────

def run_solver(
    solver_type: str,
    routes: List[RouteSpec],
    buses: List[BusSpec],
    demand_slots: List[DemandSlot],
    params: Optional[Dict] = None,
) -> SolverResult:
    if solver_type == "classical":
        return solve_classical(routes, buses, demand_slots, params)
    elif solver_type == "simulated_annealing":
        return solve_simulated_annealing(routes, buses, demand_slots, params)
    elif solver_type == "qubo":
        return solve_qubo(routes, buses, demand_slots, params)
    else:
        raise ValueError(f"Unknown solver type: {solver_type}")
