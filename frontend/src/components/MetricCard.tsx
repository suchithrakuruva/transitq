import React from 'react'

interface Props {
  value: string | number
  label: string
  sub?: string
  accent?: boolean
  loading?: boolean
}

export function MetricCard({ value, label, sub, accent, loading }: Props) {
  return (
    <div className="metric-card">
      <div className={`metric-value ${accent ? 'text-cyan-400' : 'text-white'}`}>
        {loading ? <span className="animate-pulse text-slate-600">—</span> : value}
      </div>
      <div className="metric-label">{label}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
}
