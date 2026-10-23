# TransitQ – Public-Transport Network & Bus Scheduling Optimizer

> **QAIC 2027 Hackathon Problem Statement:** “Public-Transport Network and Bus Scheduling at G. Pulla Reddy Engineering College (GPREC).”

TransitQ is a full-stack, quantum-ready transport optimization platform designed for campus-wide and regional bus scheduling. It features classical greedy time-window assignment, simulated annealing local search, and a QUBO (Quadratic Unconstrained Binary Optimization) formulation designed for quantum annealers with local CPU-based simulated annealing verification.

---

## 🚀 Key Features

1. **Executive Overview Dashboard**: High-level KPIs including active routes, terminal/campus stops, bus fleet availability, daily passenger demand, average wait time, utilization, and Pareto tradeoffs.
2. **Transport Network Manager**: Manage stops (GPS coordinates, terminal status), inter-stop connections (distance, travel time), and routes (sequence of stops). Includes an interactive, coordinate-mapped SVG network topology graph.
3. **Demand & Fleet Management**: Configurable bus fleet (capacities, fuel types: Diesel, CNG, Electric, operating costs) and time-slotted passenger demand with peak multipliers.
4. **Schedule Optimizer**: Generate timetable dispatches respecting turnaround time constraints, vehicle capacity limits, departure windows, and non-overlapping bus itineraries.
5. **Quantum Lab (QUBO Formulation)**:
   - Formulates the vehicle scheduling problem into a QUBO Hamiltonian: $\min x^T Q x$.
   - Solves via CPU-based simulated annealing.
   - **Disclaimer**: Strictly classical execution on CPU. Clearly distinguishes classical simulation from physical QPU hardware.
6. **Multi-Solver Results & Tradeoffs**: Comparative side-by-side analysis of Classical vs. Simulated Annealing vs. QUBO+SA across waiting time, cost, demand served, vehicle utilization, and runtime.
7. **Export & Reports**: Export schedules, solver comparison metrics, and dataset snapshots to CSV.
8. **Data Management & Provenance**: Validated CSV imports for stops, buses, and passenger demand with schema validation. Clear demarcation of synthetic benchmark data vs. verified field data.

---

## 🛠 Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Recharts, Lucide Icons.
- **Backend**: Python 3.14+, FastAPI, SQLAlchemy, SQLite, Pydantic v2.
- **Optimization & Solvers**: Google OR-Tools CP-SAT principles, NumPy, QUBO binary quadratic modeling, Simulated Annealing.

---

## ⚙️ Environment Variables

Create or configure an `.env` file in `transitq/backend/` if customizing:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///transitq.db` | SQLite database file location |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Allowed origins for web requests |
| `DEBUG` | `true` | FastAPI debug mode |

---

## 🖥 Windows Setup & Launch Instructions

### Prerequisites
- Python 3.10+ (tested with Python 3.14)
- Node.js 18+ & npm (tested with Node.js v24)

### 1. Backend Setup & Launch

```powershell
# Navigate to backend directory
cd "transitq\backend"

# Install dependencies
pip install -r requirements.txt

# Start backend server (runs at http://localhost:8000)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

*Interactive API Docs (Swagger UI) are available at:* `http://localhost:8000/docs`

### 2. Frontend Setup & Launch

```powershell
# Navigate to frontend directory in another terminal
cd "transitq\frontend"

# Install packages
npm install

# Start Vite dev server (runs at http://localhost:5173)
npm run dev
```

*Access the Web Application at:* `http://localhost:5173`

---

## 🧪 Automated Testing

TransitQ includes an end-to-end integration test suite covering health, data models, classical solver, simulated annealing, QUBO formulation, trip reconstruction, Pareto comparison, and CSV export:

```powershell
python "transitq\backend\test_e2e.py"
```

All 9 integration test phases pass with 100% success rate:
- `Step 1`: API Health & Overview metrics.
- `Step 2`: Transport network, stops, connections, routes, fleet, and demand inspection.
- `Step 3`: Classical greedy solver execution and trip persistence.
- `Step 4`: Simulated annealing solver execution and turnaround constraint validation.
- `Step 5`: QUBO Hamiltonian matrix formulation & classical SA solver execution.
- `Step 6`: Schedule trip retrieval and passenger allocation.
- `Step 7`: Multi-solver benchmark comparison.
- `Step 8`: Schedule, results, and stops CSV exports.
- `Step 9`: Dataset provenance check & synthetic classification verification.

---

## ⚠️ Known Limitations & Disclaimers

1. **Hardware Disclaimer**: Simulated annealing and QUBO solvers run on local classical CPU hardware. While the mathematical QUBO matrix is compatible with D-Wave or Fujitsu Digital Annealers, no physical quantum processor is utilized.
2. **Data Provenance**: Baseline stops, distances, routes, and passenger demand figures are synthetic approximations designed for the QAIC 2027 problem statement and must not be used for municipal transit operations without GPREC administrative validation.
3. **Turnaround Modeling**: Turnaround delays assume uniform terminal conditions without dynamic real-time traffic impedance.
