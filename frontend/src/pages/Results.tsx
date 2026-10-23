import React, { useEffect, useState } from 'react'
import { api, CompareResult, SolverRun } from '../api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts'
import { Download } from 'lucide-react'

const SOLVER_LABELS: Record<string, string> = {
  classical: 'Classical',
  simulated_annealing: 'SA',
  qubo: 'QUBO+SA',
}
const COLORS = { classical: '#22d3ee', simulated_annealing: '#a78bfa', qubo: '#34d399' }

type RunEntry = { id: number; runtime_seconds: number; demand_served: number; total_demand: number; avg_waiting_time_min: number; operating_cost: number; vehicle_utilization: number; feasible: boolean; total_trips: number; created_at: string }

export default function Results() {
  const [compare, setCompare] = useState<CompareResult>({})
  const [runs, setRuns] = useState<SolverRun[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.optimizer.compare(), api.optimizer.runs()])
      .then(([c, r]) => { setCompare(c); setRuns(r) })
      .finally(() => setLoading(false))
  }, [])

  const solvers = Object.keys(compare)

  const barData = [
    { metric: 'Demand Served', ...Object.fromEntries(solvers.map(s => [s, compare[s].demand_served])) },
    { metric: 'Trips', ...Object.fromEntries(solvers.map(s => [s, compare[s].total_trips])) },
  ]
  const costData = [
    { metric: 'Cost (₹)', ...Object.fromEntries(solvers.map(s => [s, Math.round(compare[s].operating_cost)])) },
  ]
  const waitData = [
    { metric: 'Wait (min)', ...Object.fromEntries(solvers.map(s => [s, compare[s].avg_waiting_time_min])) },
  ]
  const rtData = [
    { metric: 'Runtime (ms)', ...Object.fromEntries(solvers.map(s => [s, Math.round(compare[s].runtime_seconds * 1000)])) },
  ]

  const radarData = solvers.length > 0 ? [
    { metric: 'Demand %', ...Object.fromEntries(solvers.map(s => [s, Math.round(compare[s].demand_served / (compare[s].total_demand || 1) * 100)])) },
    { metric: 'Utiliz %', ...Object.fromEntries(solvers.map(s => [s, Math.round(compare[s].vehicle_utilization * 100)])) },
    { metric: 'Trips', ...Object.fromEntries(solvers.map(s => [s, compare[s].total_trips])) },
    { metric: 'Speed (inv)', ...Object.fromEntries(solvers.map(s => [s, Math.round(100 - compare[s].runtime_seconds * 10)])) },
    { metric: 'Wait (inv)', ...Object.fromEntries(solvers.map(s => [s, Math.max(0, Math.round(30 - compare[s].avg_waiting_time_min))])) },
  ] : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Results & Comparison</h1>
        <p className="text-slate-400 text-sm mt-1">Compare metrics across solver types</p>
      </div>

      {loading && <div className="text-center py-12 text-slate-500 animate-pulse">Loading…</div>}

      {!loading && solvers.length === 0 && (
        <div className="card text-center py-12 text-slate-500">
          No completed solver runs. Go to <strong>Schedule Optimizer</strong> or <strong>Quantum Lab</strong> to run optimizations first.
        </div>
      )}

      {/* Summary table */}
      {solvers.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="section-title mb-0">Latest Run – Each Solver</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700">
                  <th className="table-header">Metric</th>
                  {solvers.map(s => <th key={s} className="table-header">{SOLVER_LABELS[s] || s}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Run ID', fn: (e: RunEntry) => `#${e.id}` },
                  { label: 'Total Trips', fn: (e: RunEntry) => e.total_trips },
                  { label: 'Demand Served', fn: (e: RunEntry) => `${e.demand_served} / ${e.total_demand}` },
                  { label: 'Demand Served %', fn: (e: RunEntry) => `${(e.demand_served / (e.total_demand || 1) * 100).toFixed(1)}%` },
                  { label: 'Avg Wait (min)', fn: (e: RunEntry) => e.avg_waiting_time_min?.toFixed(2) },
                  { label: 'Operating Cost (₹)', fn: (e: RunEntry) => e.operating_cost?.toFixed(0) },
                  { label: 'Vehicle Utilization', fn: (e: RunEntry) => `${(e.vehicle_utilization * 100).toFixed(0)}%` },
                  { label: 'Feasible', fn: (e: RunEntry) => e.feasible ? '✓ Yes' : '✗ No' },
                  { label: 'Runtime (s)', fn: (e: RunEntry) => e.runtime_seconds?.toFixed(4) },
                  { label: 'Executed At', fn: (e: RunEntry) => new Date(e.created_at).toLocaleString() },
                ].map(row => (
                  <tr key={row.label} className="table-row">
                    <td className="table-cell font-medium text-slate-400">{row.label}</td>
                    {solvers.map(s => <td key={s} className="table-cell">{row.fn(compare[s] as RunEntry)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 mt-4">
            {solvers.map(s => (
              <button key={s} onClick={() => api.optimizer.exportResults(compare[s].id)}
                className="btn-secondary flex items-center gap-1 text-xs">
                <Download size={11} /> Export {SOLVER_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      {solvers.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <p className="section-title">Demand Served & Trips</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2f5e" />
                <XAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#0a1228', border: '1px solid #1a2f5e', color: '#e2e8f0' }} />
                <Legend formatter={v => SOLVER_LABELS[v] || v} />
                {solvers.map(s => <Bar key={s} dataKey={s} fill={COLORS[s as keyof typeof COLORS] || '#888'} radius={[3, 3, 0, 0]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <p className="section-title">Operating Cost (₹)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={costData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2f5e" />
                <XAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#0a1228', border: '1px solid #1a2f5e', color: '#e2e8f0' }} />
                <Legend formatter={v => SOLVER_LABELS[v] || v} />
                {solvers.map(s => <Bar key={s} dataKey={s} fill={COLORS[s as keyof typeof COLORS] || '#888'} radius={[3, 3, 0, 0]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <p className="section-title">Average Waiting Time (min)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={waitData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2f5e" />
                <XAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#0a1228', border: '1px solid #1a2f5e', color: '#e2e8f0' }} />
                <Legend formatter={v => SOLVER_LABELS[v] || v} />
                {solvers.map(s => <Bar key={s} dataKey={s} fill={COLORS[s as keyof typeof COLORS] || '#888'} radius={[3, 3, 0, 0]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <p className="section-title">Solver Runtime (ms)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={rtData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2f5e" />
                <XAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#0a1228', border: '1px solid #1a2f5e', color: '#e2e8f0' }} />
                <Legend formatter={v => SOLVER_LABELS[v] || v} />
                {solvers.map(s => <Bar key={s} dataKey={s} fill={COLORS[s as keyof typeof COLORS] || '#888'} radius={[3, 3, 0, 0]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent runs history */}
      <div className="card">
        <p className="section-title">All Runs History</p>
        {runs.length === 0 ? (
          <div className="text-slate-500 text-sm text-center py-8">No runs yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700">
                  {['#', 'Solver', 'Trips', 'Served', 'Wait (min)', 'Cost (₹)', 'Utiliz.', 'Feasible', 'Runtime', 'Export'].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell text-slate-400">#{r.id}</td>
                    <td className="table-cell"><span className={`badge ${r.solver_type === 'classical' ? 'badge-cyan' : r.solver_type === 'qubo' ? 'badge-green' : 'badge-blue'}`}>{SOLVER_LABELS[r.solver_type] || r.solver_type}</span></td>
                    <td className="table-cell">{r.total_trips}</td>
                    <td className="table-cell">{r.demand_served}/{r.total_demand}</td>
                    <td className="table-cell">{r.avg_waiting_time_min?.toFixed(1) ?? '—'}</td>
                    <td className="table-cell">{r.operating_cost?.toFixed(0) ?? '—'}</td>
                    <td className="table-cell">{r.vehicle_utilization != null ? `${(r.vehicle_utilization * 100).toFixed(0)}%` : '—'}</td>
                    <td className="table-cell"><span className={r.feasible ? 'badge-green badge' : 'badge-red badge'}>{r.feasible ? 'Yes' : 'No'}</span></td>
                    <td className="table-cell font-mono text-xs">{r.runtime_seconds?.toFixed(3) ?? '—'}s</td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        <button onClick={() => api.optimizer.exportSchedule(r.id)} className="btn-secondary px-2 py-1 text-xs">Sched</button>
                        <button onClick={() => api.optimizer.exportResults(r.id)} className="btn-secondary px-2 py-1 text-xs">Results</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
