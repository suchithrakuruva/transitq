import React, { useEffect, useState } from 'react'
import { api, OverviewMetrics, SolverRun } from '../api'
import { MetricCard } from '../components/MetricCard'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend
} from 'recharts'

const CHART_COLORS = { classical: '#22d3ee', simulated_annealing: '#a78bfa', qubo: '#34d399' }
const SOLVER_LABELS: Record<string, string> = {
  classical: 'Classical',
  simulated_annealing: 'Simulated Annealing',
  qubo: 'QUBO+SA',
}

export default function Overview() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null)
  const [runs, setRuns] = useState<SolverRun[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.overview.metrics(), api.optimizer.runs()])
      .then(([m, r]) => { setMetrics(m); setRuns(r) })
      .finally(() => setLoading(false))
  }, [])

  const runChartData = runs.slice(0, 10).reverse().map(r => ({
    name: `#${r.id} ${SOLVER_LABELS[r.solver_type] || r.solver_type}`,
    served: r.demand_served,
    wait: r.avg_waiting_time_min?.toFixed(1),
    cost: r.operating_cost?.toFixed(0),
  }))

  const demandServedPct = metrics && metrics.latest_demand_served != null && metrics.total_demand > 0
    ? `${((metrics.latest_demand_served / metrics.total_demand) * 100).toFixed(1)}%`
    : '—'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-slate-400 text-sm mt-1">
          G. Pulla Reddy Engineering College – Public Transport Dashboard
          <span className="ml-2 badge badge-yellow">Synthetic Demo Data</span>
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard value={metrics?.total_routes ?? '—'} label="Routes" loading={loading} />
        <MetricCard value={metrics?.total_stops ?? '—'} label="Stops" loading={loading} />
        <MetricCard value={`${metrics?.available_buses ?? '—'} / ${metrics?.total_buses ?? '—'}`} label="Buses Available" loading={loading} />
        <MetricCard value={metrics?.total_demand ?? '—'} label="Daily Demand (pax)" loading={loading} />
        <MetricCard
          value={metrics?.latest_avg_waiting_time != null ? `${metrics.latest_avg_waiting_time.toFixed(1)} min` : '—'}
          label="Avg Wait Time" accent loading={loading}
        />
        <MetricCard value={demandServedPct} label="Demand Served" accent loading={loading} />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          value={metrics?.latest_operating_cost != null ? `₹${metrics.latest_operating_cost.toFixed(0)}` : '—'}
          label="Operating Cost" loading={loading}
        />
        <MetricCard
          value={metrics?.latest_vehicle_utilization != null ? `${(metrics.latest_vehicle_utilization * 100).toFixed(0)}%` : '—'}
          label="Vehicle Utilization" loading={loading}
        />
        <MetricCard value={metrics?.solver_runs_count ?? 0} label="Optimizer Runs" loading={loading} />
        <MetricCard
          value={metrics?.latest_feasible != null ? (metrics.latest_feasible ? 'Yes' : 'No') : '—'}
          label="Last Run Feasible" accent loading={loading}
        />
      </div>

      {/* Charts */}
      {runs.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <p className="section-title">Passengers Served – Recent Runs</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={runChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2f5e" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#0a1228', border: '1px solid #1a2f5e', color: '#e2e8f0' }} />
                <Bar dataKey="served" fill="#22d3ee" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <p className="section-title">Avg Wait Time – Recent Runs</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={runChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2f5e" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#0a1228', border: '1px solid #1a2f5e', color: '#e2e8f0' }} />
                <Line type="monotone" dataKey="wait" stroke="#a78bfa" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent runs table */}
      <div className="card">
        <p className="section-title">Recent Solver Runs</p>
        {runs.length === 0 ? (
          <div className="text-slate-500 text-sm text-center py-8">
            No optimizer runs yet. Go to <strong>Schedule Optimizer</strong> to run an optimization.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700">
                  {['#', 'Solver', 'Trips', 'Served', 'Wait (min)', 'Cost (₹)', 'Utiliz.', 'Feasible', 'Runtime'].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell text-slate-400">#{r.id}</td>
                    <td className="table-cell">
                      <span className={`badge ${r.solver_type === 'classical' ? 'badge-cyan' : r.solver_type === 'qubo' ? 'badge-green' : 'badge-blue'}`}>
                        {SOLVER_LABELS[r.solver_type] || r.solver_type}
                      </span>
                    </td>
                    <td className="table-cell">{r.total_trips}</td>
                    <td className="table-cell">{r.demand_served} / {r.total_demand}</td>
                    <td className="table-cell">{r.avg_waiting_time_min?.toFixed(1) ?? '—'}</td>
                    <td className="table-cell">{r.operating_cost?.toFixed(0) ?? '—'}</td>
                    <td className="table-cell">{r.vehicle_utilization != null ? `${(r.vehicle_utilization * 100).toFixed(0)}%` : '—'}</td>
                    <td className="table-cell">
                      <span className={r.feasible ? 'badge-green badge' : 'badge-red badge'}>
                        {r.feasible ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="table-cell font-mono text-xs">{r.runtime_seconds?.toFixed(3) ?? '—'}s</td>
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
