import React, { useEffect, useState } from 'react'
import { api, SolverRun, Trip } from '../api'
import { Alert } from '../components/Alert'
import { DataTable } from '../components/DataTable'
import { Play, Download, ChevronDown, ChevronUp } from 'lucide-react'

const SOLVER_LABELS: Record<string, string> = {
  classical: 'Classical (Greedy)',
  simulated_annealing: 'Simulated Annealing',
  qubo: 'QUBO + SA',
}

interface Params {
  turnaround_min: number
  start_hour: number
  end_hour: number
  max_iter?: number
  init_temp?: number
  cooling_rate?: number
}

export default function ScheduleOptimizer() {
  const [runs, setRuns] = useState<SolverRun[]>([])
  const [selectedRun, setSelectedRun] = useState<SolverRun | null>(null)
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(false)
  const [runLoading, setRunLoading] = useState(false)
  const [err, setErr] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [solverType, setSolverType] = useState('classical')
  const [params, setParams] = useState<Params>({
    turnaround_min: 10, start_hour: 6, end_hour: 20, max_iter: 5000, init_temp: 50.0, cooling_rate: 0.995,
  })

  const loadRuns = () => {
    setLoading(true)
    api.optimizer.runs().then(r => setRuns(r)).finally(() => setLoading(false))
  }
  useEffect(loadRuns, [])

  async function runOptimizer() {
    setRunLoading(true); setErr('')
    try {
      const p: Record<string, number | undefined> = {
        turnaround_min: params.turnaround_min,
        start_hour: params.start_hour,
        end_hour: params.end_hour,
      }
      if (solverType !== 'classical') {
        p.max_iter = params.max_iter
        p.init_temp = params.init_temp
        p.cooling_rate = params.cooling_rate
      }
      const run = await api.optimizer.run(solverType, p)
      loadRuns()
      selectRun(run)
    } catch (e: unknown) { setErr((e as Error).message) } finally { setRunLoading(false) }
  }

  async function selectRun(run: SolverRun) {
    setSelectedRun(run)
    const t = await api.optimizer.getTrips(run.id)
    setTrips(t)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Schedule Optimizer</h1>
        <p className="text-slate-400 text-sm mt-1">Generate optimal bus schedules using selected solver</p>
      </div>

      {/* Config panel */}
      <div className="card space-y-4">
        <p className="section-title">Optimizer Configuration</p>
        {err && <Alert message={err} />}

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="label">Solver Type</label>
            <select className="input" value={solverType} onChange={e => setSolverType(e.target.value)}>
              <option value="classical">Classical (Greedy)</option>
              <option value="simulated_annealing">Simulated Annealing</option>
              <option value="qubo">QUBO + Simulated Annealing</option>
            </select>
          </div>
          <div>
            <label className="label">Start Hour</label>
            <input className="input" type="number" min={0} max={23} value={params.start_hour}
              onChange={e => setParams(p => ({ ...p, start_hour: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="label">End Hour</label>
            <input className="input" type="number" min={0} max={23} value={params.end_hour}
              onChange={e => setParams(p => ({ ...p, end_hour: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Turnaround Time (min)</label>
            <input className="input" type="number" min={0} value={params.turnaround_min}
              onChange={e => setParams(p => ({ ...p, turnaround_min: Number(e.target.value) }))} />
          </div>
        </div>

        {/* Advanced SA params */}
        {solverType !== 'classical' && (
          <div>
            <button onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
              {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Advanced SA Parameters
            </button>
            {showAdvanced && (
              <div className="grid md:grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="label">Max Iterations</label>
                  <input className="input" type="number" value={params.max_iter}
                    onChange={e => setParams(p => ({ ...p, max_iter: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Initial Temperature</label>
                  <input className="input" type="number" step="any" value={params.init_temp}
                    onChange={e => setParams(p => ({ ...p, init_temp: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Cooling Rate</label>
                  <input className="input" type="number" step="0.001" value={params.cooling_rate}
                    onChange={e => setParams(p => ({ ...p, cooling_rate: Number(e.target.value) }))} />
                </div>
              </div>
            )}
          </div>
        )}

        {solverType === 'qubo' && (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 text-xs text-yellow-300">
            ⚠ <strong>Disclaimer:</strong> QUBO + SA runs on a classical CPU. No quantum hardware is used.
            The QUBO matrix is quantum-annealer compatible but solved here by classical simulated annealing for validation.
          </div>
        )}

        <button onClick={runOptimizer} disabled={runLoading} className="btn-primary flex items-center gap-2">
          <Play size={14} /> {runLoading ? 'Running…' : 'Run Optimizer'}
        </button>
      </div>

      {/* Run history */}
      <div className="card">
        <p className="section-title">Solver Run History</p>
        <DataTable
          loading={loading}
          data={runs}
          emptyMsg="No runs yet. Configure and click 'Run Optimizer'."
          columns={[
            { key: 'id', label: '#', render: r => `#${r.id}` },
            { key: 'solver_type', label: 'Solver', render: r => <span className={`badge ${r.solver_type === 'classical' ? 'badge-cyan' : r.solver_type === 'qubo' ? 'badge-green' : 'badge-blue'}`}>{SOLVER_LABELS[r.solver_type] || r.solver_type}</span> },
            { key: 'total_trips', label: 'Trips' },
            { key: 'demand_served', label: 'Served', render: r => `${r.demand_served}/${r.total_demand}` },
            { key: 'avg_waiting_time_min', label: 'Wait (min)', render: r => r.avg_waiting_time_min?.toFixed(1) ?? '—' },
            { key: 'operating_cost', label: 'Cost (₹)', render: r => r.operating_cost?.toFixed(0) ?? '—' },
            { key: 'vehicle_utilization', label: 'Utiliz.', render: r => r.vehicle_utilization != null ? `${(r.vehicle_utilization * 100).toFixed(0)}%` : '—' },
            { key: 'feasible', label: 'Feasible', render: r => r.feasible ? <span className="badge-green badge">Yes</span> : <span className="badge-red badge">No</span> },
            { key: 'runtime_seconds', label: 'Runtime', render: r => <span className="font-mono text-xs">{r.runtime_seconds?.toFixed(3) ?? '—'}s</span> },
            { key: 'created_at', label: 'Time', render: r => new Date(r.created_at).toLocaleTimeString() },
          ]}
          actions={r => (
            <div className="flex gap-1">
              <button onClick={() => selectRun(r)} className="btn-secondary px-2 py-1 text-xs">View</button>
              <button onClick={() => api.optimizer.exportSchedule(r.id)} className="btn-secondary px-2 py-1 text-xs"><Download size={11} /></button>
            </div>
          )}
        />
      </div>

      {/* Selected run trips */}
      {selectedRun && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="section-title mb-0">Trip Schedule – Run #{selectedRun.id}</p>
              <p className="text-xs text-slate-500 mt-1">{SOLVER_LABELS[selectedRun.solver_type]} · {trips.length} trips · ₹{selectedRun.operating_cost?.toFixed(0)}</p>
            </div>
            <button onClick={() => api.optimizer.exportSchedule(selectedRun.id)} className="btn-secondary flex items-center gap-1 text-xs">
              <Download size={12} /> Export Schedule
            </button>
          </div>
          <DataTable
            data={trips}
            emptyMsg="No trips in this run."
            columns={[
              { key: 'route_name', label: 'Route' },
              { key: 'bus_number', label: 'Bus' },
              { key: 'departure_time', label: 'Depart' },
              { key: 'arrival_time', label: 'Arrive' },
              { key: 'passengers_served', label: 'Pax Served' },
              { key: 'status', label: 'Status', render: t => <span className="badge-green badge">{t.status}</span> },
            ]}
          />
        </div>
      )}
    </div>
  )
}
