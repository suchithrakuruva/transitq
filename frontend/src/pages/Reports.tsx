import React, { useEffect, useState } from 'react'
import { api, SolverRun } from '../api'
import { Download, FileText } from 'lucide-react'

const SOLVER_LABELS: Record<string, string> = {
  classical: 'Classical Greedy',
  simulated_annealing: 'Simulated Annealing',
  qubo: 'QUBO + SA',
}

export default function Reports() {
  const [runs, setRuns] = useState<SolverRun[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.optimizer.runs().then(r => setRuns(r)).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Reports & Data Export</h1>
        <p className="text-slate-400 text-sm mt-1">Export all datasets and optimization results to CSV</p>
      </div>

      {/* Dataset exports */}
      <div className="card">
        <p className="section-title">Dataset Exports</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Stops', desc: 'All bus stops with coordinates', fn: api.network.exportStops },
            { label: 'Routes', desc: 'Routes with stop sequences', fn: api.network.exportRoutes },
            { label: 'Fleet (Buses)', desc: 'Bus fleet and capacities', fn: api.fleet.exportBuses },
            { label: 'Demand Data', desc: 'Passenger demand by route/slot', fn: api.fleet.exportDemands },
          ].map(({ label, desc, fn }) => (
            <button key={label} onClick={fn}
              className="card hover:bg-navy-800 transition-colors text-left flex items-start gap-3 cursor-pointer">
              <FileText size={18} className="text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-white text-sm">{label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{desc}</div>
                <div className="text-xs text-cyan-400 mt-1 flex items-center gap-1"><Download size={10} /> Download CSV</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Run exports */}
      <div className="card">
        <p className="section-title">Solver Run Exports</p>
        {loading && <div className="text-center py-8 text-slate-500 animate-pulse">Loading…</div>}
        {!loading && runs.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">
            No solver runs. Go to <strong>Schedule Optimizer</strong> to generate schedules.
          </div>
        )}
        {!loading && runs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700">
                  {['Run', 'Solver', 'Status', 'Trips', 'Demand Served', 'Feasible', 'Created', 'Exports'].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell text-slate-400 font-mono">#{r.id}</td>
                    <td className="table-cell">
                      <span className={`badge ${r.solver_type === 'classical' ? 'badge-cyan' : r.solver_type === 'qubo' ? 'badge-green' : 'badge-blue'}`}>
                        {SOLVER_LABELS[r.solver_type] || r.solver_type}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={r.status === 'completed' ? 'badge-green badge' : r.status === 'failed' ? 'badge-red badge' : 'badge-yellow badge'}>
                        {r.status}
                      </span>
                    </td>
                    <td className="table-cell">{r.total_trips}</td>
                    <td className="table-cell">{r.demand_served}/{r.total_demand}</td>
                    <td className="table-cell">
                      <span className={r.feasible ? 'text-emerald-400' : 'text-red-400'}>{r.feasible ? 'Yes' : 'No'}</span>
                    </td>
                    <td className="table-cell text-xs text-slate-400">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        <button onClick={() => api.optimizer.exportSchedule(r.id)}
                          className="btn-secondary px-2 py-1 text-xs flex items-center gap-1">
                          <Download size={10} /> Schedule
                        </button>
                        <button onClick={() => api.optimizer.exportResults(r.id)}
                          className="btn-secondary px-2 py-1 text-xs flex items-center gap-1">
                          <Download size={10} /> Results
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Data note */}
      <div className="card text-xs text-slate-400 space-y-1">
        <p className="font-medium text-slate-300">Data Provenance Note</p>
        <p>All data in this application is <strong>SYNTHETIC / ILLUSTRATIVE</strong> and has been generated for the QAIC 2027 hackathon demonstration. Stop coordinates, route distances, travel times, and passenger demand figures are approximate and NOT verified GPREC operational data.</p>
        <p>Do not use this data for actual operational planning without verification from GPREC transport authorities.</p>
      </div>
    </div>
  )
}
