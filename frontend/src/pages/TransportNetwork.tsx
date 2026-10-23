import React, { useEffect, useState } from 'react'
import { api, Stop, Connection, Route } from '../api'
import { DataTable } from '../components/DataTable'
import { Modal } from '../components/Modal'
import { Alert } from '../components/Alert'
import { Plus, Trash2, Download, Network } from 'lucide-react'

// ── Stop Form ───────────────────────────────────────────────
function StopForm({ onClose, onSaved }: { onClose?: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', code: '', latitude: '', longitude: '', description: '', is_terminal: false })
  const [err, setErr] = useState('')
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    try {
      await api.network.createStop({
        name: form.name, code: form.code.toUpperCase(),
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        description: form.description || undefined,
        is_terminal: form.is_terminal,
      })
      onSaved(); onClose?.()
    } catch (e: unknown) { setErr((e as Error).message) }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {err && <Alert message={err} />}
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Stop Name *</label><input className="input" value={form.name} onChange={f('name')} required /></div>
        <div><label className="label">Code *</label><input className="input" value={form.code} onChange={f('code')} required maxLength={20} /></div>
        <div><label className="label">Latitude</label><input className="input" type="number" step="any" value={form.latitude} onChange={f('latitude')} /></div>
        <div><label className="label">Longitude</label><input className="input" type="number" step="any" value={form.longitude} onChange={f('longitude')} /></div>
      </div>
      <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={f('description')} /></div>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={form.is_terminal} onChange={e => setForm(p => ({ ...p, is_terminal: e.target.checked }))} className="w-4 h-4" />
        Terminal stop
      </label>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary">Add Stop</button>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}

// ── Route Form ──────────────────────────────────────────────
function RouteForm({ stops, onClose, onSaved }: { stops: Stop[]; onClose?: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', code: '', stop_ids: '', dist: '', dur: '' })
  const [err, setErr] = useState('')
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const stopIds = form.stop_ids.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
    if (stopIds.length < 2) { setErr('Enter at least 2 comma-separated stop IDs'); return }
    try {
      await api.network.createRoute({
        name: form.name, code: form.code.toUpperCase(),
        stop_sequence: stopIds,
        total_distance_km: Number(form.dist) || 0,
        estimated_duration_min: Number(form.dur) || 0,
        is_active: true,
      })
      onSaved(); onClose?.()
    } catch (e: unknown) { setErr((e as Error).message) }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {err && <Alert message={err} />}
      <div className="card bg-navy-800 text-xs text-slate-400 p-3">
        <strong>Available stop IDs:</strong>{' '}
        {stops.map(s => `${s.id}=${s.code}`).join(', ')}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Route Name *</label><input className="input" value={form.name} onChange={f('name')} required /></div>
        <div><label className="label">Code *</label><input className="input" value={form.code} onChange={f('code')} required /></div>
        <div><label className="label">Distance (km)</label><input className="input" type="number" step="any" value={form.dist} onChange={f('dist')} /></div>
        <div><label className="label">Duration (min)</label><input className="input" type="number" step="any" value={form.dur} onChange={f('dur')} /></div>
      </div>
      <div><label className="label">Stop IDs (comma-separated, in order) *</label><input className="input" value={form.stop_ids} onChange={f('stop_ids')} placeholder="1,2,3,4" required /></div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary">Add Route</button>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}

// ── Connection Form ─────────────────────────────────────────
function ConnectionForm({ stops, onClose, onSaved }: { stops: Stop[]; onClose?: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ from_stop_id: '', to_stop_id: '', distance_km: '', travel_time_min: '', is_bidirectional: true })
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    try {
      await api.network.createConnection({
        from_stop_id: Number(form.from_stop_id),
        to_stop_id: Number(form.to_stop_id),
        distance_km: Number(form.distance_km),
        travel_time_min: Number(form.travel_time_min),
        is_bidirectional: form.is_bidirectional,
      })
      onSaved(); onClose?.()
    } catch (e: unknown) { setErr((e as Error).message) }
  }

  const stopOptions = stops.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)
  return (
    <form onSubmit={submit} className="space-y-3">
      {err && <Alert message={err} />}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">From Stop *</label>
          <select className="input" value={form.from_stop_id} onChange={e => setForm(p => ({ ...p, from_stop_id: e.target.value }))} required>
            <option value="">Select…</option>{stopOptions}
          </select>
        </div>
        <div>
          <label className="label">To Stop *</label>
          <select className="input" value={form.to_stop_id} onChange={e => setForm(p => ({ ...p, to_stop_id: e.target.value }))} required>
            <option value="">Select…</option>{stopOptions}
          </select>
        </div>
        <div><label className="label">Distance (km) *</label><input className="input" type="number" step="any" value={form.distance_km} onChange={e => setForm(p => ({ ...p, distance_km: e.target.value }))} required /></div>
        <div><label className="label">Travel Time (min) *</label><input className="input" type="number" step="any" value={form.travel_time_min} onChange={e => setForm(p => ({ ...p, travel_time_min: e.target.value }))} required /></div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={form.is_bidirectional} onChange={e => setForm(p => ({ ...p, is_bidirectional: e.target.checked }))} className="w-4 h-4" />
        Bidirectional connection
      </label>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary">Add Connection</button>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}

// ── Network Graph View (SVG-based) ──────────────────────────
function NetworkView({ stops, connections }: { stops: Stop[]; connections: Connection[] }) {
  const W = 700, H = 420, PAD = 50
  const lats = stops.map(s => s.latitude).filter(Boolean) as number[]
  const lons = stops.map(s => s.longitude).filter(Boolean) as number[]
  if (lats.length === 0) return <div className="text-slate-500 text-sm text-center py-8">Add latitude/longitude to stops to see the network graph.</div>

  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLon = Math.min(...lons), maxLon = Math.max(...lons)

  const posOf = (s: Stop) => {
    if (!s.latitude || !s.longitude) return null
    const x = PAD + ((s.longitude - minLon) / (maxLon - minLon || 1)) * (W - 2 * PAD)
    const y = H - PAD - ((s.latitude - minLat) / (maxLat - minLat || 1)) * (H - 2 * PAD)
    return { x, y }
  }

  const stopMap = Object.fromEntries(stops.map(s => [s.id, s]))

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="bg-navy-950 rounded-lg border border-navy-700">
      {connections.map(c => {
        const a = posOf(stopMap[c.from_stop_id]), b = posOf(stopMap[c.to_stop_id])
        if (!a || !b) return null
        return (
          <line key={c.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="#243d7a" strokeWidth={1.5}
            markerEnd={c.is_bidirectional ? undefined : 'url(#arrow)'} />
        )
      })}
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
        </marker>
      </defs>
      {stops.map(s => {
        const pos = posOf(s)
        if (!pos) return null
        return (
          <g key={s.id}>
            <circle cx={pos.x} cy={pos.y} r={s.is_terminal ? 8 : 5}
              fill={s.is_terminal ? '#06b6d4' : '#243d7a'}
              stroke={s.is_terminal ? '#22d3ee' : '#1a2f5e'} strokeWidth={2} />
            <text x={pos.x} y={pos.y - 12} textAnchor="middle" fill="#94a3b8" fontSize={9}>{s.code}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Main Page ───────────────────────────────────────────────
export default function TransportNetwork() {
  const [stops, setStops] = useState<Stop[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'stops' | 'connections' | 'routes' | 'map'>('stops')

  const reload = () => {
    setLoading(true)
    Promise.all([api.network.stops(), api.network.connections(), api.network.routes()])
      .then(([s, c, r]) => { setStops(s); setConnections(c); setRoutes(r) })
      .finally(() => setLoading(false))
  }
  useEffect(reload, [])

  const tabs = [
    { key: 'stops', label: `Stops (${stops.length})` },
    { key: 'connections', label: `Connections (${connections.length})` },
    { key: 'routes', label: `Routes (${routes.length})` },
    { key: 'map', label: 'Network Map' },
  ] as const

  const stopMap = Object.fromEntries(stops.map(s => [s.id, s.name]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Transport Network</h1>
          <p className="text-slate-400 text-sm mt-1">Manage stops, connections, and routes</p>
        </div>
        <div className="flex gap-2">
          <button onClick={api.network.exportStops} className="btn-secondary flex items-center gap-1">
            <Download size={14} /> Stops CSV
          </button>
          <button onClick={api.network.exportRoutes} className="btn-secondary flex items-center gap-1">
            <Download size={14} /> Routes CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-navy-700">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === 'stops' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="section-title mb-0">Bus Stops</p>
              <Modal title="Add Stop" trigger={<button className="btn-primary flex items-center gap-1"><Plus size={14} /> Add Stop</button>}>
                <StopForm onSaved={reload} />
              </Modal>
            </div>
            <DataTable
              loading={loading}
              data={stops}
              emptyMsg="No stops. Add your first stop."
              columns={[
                { key: 'code', label: 'Code' },
                { key: 'name', label: 'Name' },
                { key: 'latitude', label: 'Lat', render: s => s.latitude?.toFixed(4) ?? '—' },
                { key: 'longitude', label: 'Lon', render: s => s.longitude?.toFixed(4) ?? '—' },
                { key: 'is_terminal', label: 'Terminal', render: s => s.is_terminal ? <span className="badge-cyan badge">Yes</span> : '—' },
              ]}
              actions={s => (
                <button onClick={async () => { await api.network.deleteStop(s.id); reload() }} className="btn-danger px-2 py-1 text-xs"><Trash2 size={12} /></button>
              )}
            />
          </>
        )}

        {activeTab === 'connections' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="section-title mb-0">Connections</p>
              <Modal title="Add Connection" trigger={<button className="btn-primary flex items-center gap-1"><Plus size={14} /> Add Connection</button>}>
                <ConnectionForm stops={stops} onSaved={reload} />
              </Modal>
            </div>
            <DataTable
              loading={loading}
              data={connections}
              emptyMsg="No connections yet."
              columns={[
                { key: 'from_stop_name', label: 'From' },
                { key: 'to_stop_name', label: 'To' },
                { key: 'distance_km', label: 'Distance (km)', render: c => c.distance_km.toFixed(1) },
                { key: 'travel_time_min', label: 'Time (min)', render: c => c.travel_time_min.toFixed(0) },
                { key: 'is_bidirectional', label: 'Bidirectional', render: c => c.is_bidirectional ? <span className="badge-green badge">Yes</span> : <span className="badge-yellow badge">One-way</span> },
              ]}
              actions={c => (
                <button onClick={async () => { await api.network.deleteConnection(c.id); reload() }} className="btn-danger px-2 py-1 text-xs"><Trash2 size={12} /></button>
              )}
            />
          </>
        )}

        {activeTab === 'routes' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="section-title mb-0">Routes</p>
              <Modal title="Add Route" trigger={<button className="btn-primary flex items-center gap-1"><Plus size={14} /> Add Route</button>}>
                <RouteForm stops={stops} onSaved={reload} />
              </Modal>
            </div>
            <DataTable
              loading={loading}
              data={routes}
              emptyMsg="No routes yet."
              columns={[
                { key: 'code', label: 'Code' },
                { key: 'name', label: 'Name' },
                { key: 'stop_sequence', label: 'Stops', render: r => (r.stop_sequence || []).map((id: number) => stopMap[id] || id).join(' → ') },
                { key: 'total_distance_km', label: 'Dist (km)', render: r => r.total_distance_km.toFixed(1) },
                { key: 'estimated_duration_min', label: 'Duration (min)', render: r => r.estimated_duration_min.toFixed(0) },
                { key: 'is_active', label: 'Active', render: r => r.is_active ? <span className="badge-green badge">Yes</span> : <span className="badge-red badge">No</span> },
              ]}
              actions={r => (
                <button onClick={async () => { await api.network.deleteRoute(r.id); reload() }} className="btn-danger px-2 py-1 text-xs"><Trash2 size={12} /></button>
              )}
            />
          </>
        )}

        {activeTab === 'map' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Network size={16} className="text-cyan-400" />
              <p className="section-title mb-0">Network Graph (SVG – based on stop coordinates)</p>
            </div>
            <div className="flex gap-4 text-xs text-slate-400 mb-3">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-cyan-500 inline-block" /> Terminal</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-navy-600 inline-block" /> Stop</span>
            </div>
            <NetworkView stops={stops} connections={connections} />
          </div>
        )}
      </div>
    </div>
  )
}
