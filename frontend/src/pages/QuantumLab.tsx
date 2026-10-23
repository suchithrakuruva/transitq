import React, { useState } from 'react'
import { api, SolverRun } from '../api'
import { Alert } from '../components/Alert'
import { Play, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

const SOLVER_LABELS: Record<string, string> = {
  classical: 'Classical',
  simulated_annealing: 'Simulated Annealing (CPU)',
  qubo: 'QUBO+SA (CPU)',
}

interface QUBOInfo {
  n_variables?: number
  qubo_density?: number
  best_qubo_energy?: number
  disclaimer?: string
}

export default function QuantumLab() {
  const [running, setRunning] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [results, setResults] = useState<Record<string, SolverRun>>({})
  const [quboInfo, setQuboInfo] = useState<QUBOInfo | null>(null)

  async function runSolver(type: string) {
    setRunning(type); setErr('')
    try {
      const run = await api.optimizer.run(type, { turnaround_min: 10, start_hour: 6, end_hour: 20, max_iter: 3000 })
      setResults(prev => ({ ...prev, [type]: run }))
      if (type === 'qubo' && run.result_summary) {
        setQuboInfo(run.result_summary as QUBOInfo)
      }
    } catch (e: unknown) { setErr((e as Error).message) } finally { setRunning(null) }
  }

  const solvers = ['classical', 'simulated_annealing', 'qubo']
  const chartData = [
    {
      metric: 'Demand Served',
      ...Object.fromEntries(solvers.filter(s => results[s]).map(s => [s, results[s].demand_served]))
    },
    {
      metric: 'Trips',
      ...Object.fromEntries(solvers.filter(s => results[s]).map(s => [s, results[s].total_trips]))
    },
    {
      metric: 'Wait (min×10)',
      ...Object.fromEntries(solvers.filter(s => results[s]).map(s => [s, (results[s].avg_waiting_time_min ?? 0) * 10]))
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Quantum Lab</h1>
        <p className="text-slate-400 text-sm mt-1">
          QUBO formulation and classical baseline comparison
        </p>
      </div>

      {/* Disclaimer */}
      <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-yellow-400 mt-0.5 shrink-0" />
          <div className="text-sm text-yellow-200 space-y-1">
            <p className="font-semibold">Quantum Hardware Disclaimer</p>
            <p>
              All solvers in this lab run on classical CPU hardware. The QUBO formulation is mathematically
              compatible with quantum annealers (e.g. D-Wave, Fujitsu DAU), but execution is performed by
              classical simulated annealing for validation and benchmarking. No quantum hardware is used.
            </p>
            <p className="text-yellow-400 text-xs mt-1">
              This is a QAIC 2027 Hackathon demonstration — results are based on synthetic GPREC data.
            </p>
          </div>
        </div>
      </div>

      {/* QUBO explanation */}
      <div className="card space-y-3">
        <p className="section-title">QUBO Problem Formulation</p>
        <div className="text-sm text-slate-300 space-y-2">
          <p>The scheduling problem is formulated as a <strong className="text-cyan-400">Quadratic Unconstrained Binary Optimization (QUBO)</strong> problem:</p>
          <div className="bg-navy-950 rounded-lg p-3 font-mono text-xs text-cyan-300">
            {'minimize  x^T Q x'}
            <br />
            {'where x ∈ {0,1}^N,  N = n_slots × n_buses'}
          </div>
          <p className="text-slate-400 text-xs">
            Variable <code>x_ik = 1</code> means demand slot <code>i</code> is served by bus <code>k</code>.
            The Q matrix encodes: (1) reward for serving passengers, (2) penalty for assigning multiple buses
            to the same slot, (3) penalty for overlapping bus assignments.
          </p>
        </div>
        {quboInfo && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <div className="bg-navy-800 rounded-lg p-3">
              <div className="text-lg font-bold text-white">{quboInfo.n_variables ?? '—'}</div>
              <div className="text-xs text-slate-400">QUBO Variables</div>
            </div>
            <div className="bg-navy-800 rounded-lg p-3">
              <div className="text-lg font-bold text-white">{quboInfo.qubo_density?.toFixed(4) ?? '—'}</div>
              <div className="text-xs text-slate-400">Matrix Density</div>
            </div>
            <div className="bg-navy-800 rounded-lg p-3">
              <div className="text-lg font-bold text-white">{quboInfo.best_qubo_energy?.toFixed(2) ?? '—'}</div>
              <div className="text-xs text-slate-400">Best QUBO Energy</div>
            </div>
            <div className="bg-navy-800 rounded-lg p-3">
              <div className="text-lg font-bold text-cyan-400">CPU SA</div>
              <div className="text-xs text-slate-400">Solver Backend</div>
            </div>
          </div>
        )}
      </div>

      {/* Run buttons */}
      {err && <Alert message={err} />}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { type: 'classical', label: 'Classical Greedy', color: 'cyan', desc: 'Greedy time-window assignment. Fast, deterministic.' },
          { type: 'simulated_annealing', label: 'Simulated Annealing', color: 'purple', desc: 'Local search on scheduling state space. QUBO-compatible objective.' },
          { type: 'qubo', label: 'QUBO + SA', color: 'green', desc: 'Explicit QUBO matrix + SA solver. Quantum-annealer compatible formulation.' },
        ].map(({ type, label, color, desc }) => (
          <div key={type} className="card space-y-3">
            <div>
              <h3 className={`font-semibold text-${color}-400`}>{label}</h3>
              <p className="text-xs text-slate-400 mt-1">{desc}</p>
            </div>
            {results[type] && (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Trips</span><span>{results[type].total_trips}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Served</span><span>{results[type].demand_served}/{results[type].total_demand}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Wait</span><span>{results[type].avg_waiting_time_min?.toFixed(1)} min</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Cost</span><span>₹{results[type].operating_cost?.toFixed(0)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Runtime</span><span className="font-mono text-xs">{results[type].runtime_seconds?.toFixed(3)}s</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Feasible</span>
                  <span className={results[type].feasible ? 'text-emerald-400' : 'text-red-400'}>{results[type].feasible ? 'Yes' : 'No'}</span>
                </div>
              </div>
            )}
            <button
              onClick={() => runSolver(type)}
              disabled={running !== null}
              className="btn-primary flex items-center gap-2 w-full justify-center"
            >
              <Play size={13} /> {running === type ? 'Running…' : `Run ${label}`}
            </button>
          </div>
        ))}
      </div>

      {/* Comparison chart */}
      {Object.keys(results).length > 1 && (
        <div className="card">
          <p className="section-title">Solver Comparison</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2f5e" />
              <XAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0a1228', border: '1px solid #1a2f5e', color: '#e2e8f0' }} />
              <Legend formatter={(v) => SOLVER_LABELS[v] || v} />
              {solvers.filter(s => results[s]).map((s, i) => (
                <Bar key={s} dataKey={s} fill={['#22d3ee', '#a78bfa', '#34d399'][i]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 mt-2">* Wait time multiplied by 10 for chart visibility</p>
        </div>
      )}

      {/* Validation note */}
      <div className="card text-sm text-slate-400 space-y-2">
        <p className="font-semibold text-slate-300">Independent Validation</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Each run is independently executed and persisted in SQLite.</li>
          <li>Trips from each solver are reconstructed from the best solution found, with overlap checks applied post-hoc.</li>
          <li>Demand served counts only trips where bus capacity ≥ effective passenger demand.</li>
          <li>Operating cost = Σ (route distance × bus cost/km) per assigned trip.</li>
          <li>Vehicle utilization = (distinct buses used) / (total available buses).</li>
          <li>Results can be exported to CSV for external verification.</li>
        </ul>
      </div>
    </div>
  )
}
