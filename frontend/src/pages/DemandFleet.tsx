import React, { useEffect, useState } from 'react'
import { api, Bus, Demand, Route } from '../api'
import { DataTable } from '../components/DataTable'
import { Modal } from '../components/Modal'
import { Alert } from '../components/Alert'
import { Plus, Trash2, Download, Edit2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

// ── Bus Form ────────────────────────────────────────────────
function BusForm({ onClose, onSaved }: { onClose?: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ number: '', capacity: '50', fuel_type: 'Diesel', operating_cost_per_km: '12.0' })
  const [err, setErr] = useState('')
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    try {
      await api.fleet.createBus({
        number: form.number, capacity: Number(form.capacity),
        fuel_type: form.fuel_type, operating_cost_per_km: Number(form.operating_cost_per_km),
        is_available: true,
      })
      onSaved(); onClose?.()
    } catch (e: unknown) { setErr((e as Error).message) }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {err && <Alert message={err} />}
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Bus Number *</label><input className="input" value={form.number} onChange={f('number')} required placeholder="AP-09-TC-XXXX" /></div>
        <div><label className="label">Capacity *</label><input className="input" type="number" value={form.capacity} onChange={f('capacity')} required min={1} /></div>
        <div>
          <label className="label">Fuel Type</label>
          <select className="input" value={form.fuel_type} onChange={f('fuel_type')}>
            <option>Diesel</option><option>CNG</option><option>Electric</option><option>Hybrid</option>
          </select>
        </div>
        <div><label className="label">Cost / km (₹)</label><input className="input" type="number" step="0.5" value={form.operating_cost_per_km} onChange={f('operating_cost_per_km')} /></div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary">Add Bus</button>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}

// ── Demand Form ─────────────────────────────────────────────
function DemandForm({ routes, onClose, onSaved }: { routes: Route[]; onClose?: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ route_id: '', time_slot: '08:00', passengers: '40', peak_multiplier: '1.0' })
  const [err, setErr] = useState('')
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    try {
      await api.fleet.createDemand({
        route_id: Number(form.route_id),
        time_slot: form.time_slot,
        passengers: Number(form.passengers),
        peak_multiplier: Number(form.peak_multiplier),
      })
      onSaved(); onClose?.()
    } catch (e: unknown) { setErr((e as Error).message) }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {err && <Alert message={err} />}
      <div>
        <label className="label">Route *</label>
        <select className="input" value={form.route_id} onChange={f('route_id')} required>
          <option value="">Select route…</option>
          {routes.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="label">Time Slot (HH:MM) *</label><input className="input" value={form.time_slot} onChange={f('time_slot')} pattern="\d{2}:\d{2}" required /></div>
        <div><label className="label">Passengers *</label><input className="input" type="number" value={form.passengers} onChange={f('passengers')} required min={0} /></div>
        <div><label className="label">Peak Multiplier</label><input className="input" type="number" step="0.1" value={form.peak_multiplier} onChange={f('peak_multiplier')} min={0.1} /></div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary">Add Demand</button>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}

// ── Edit Bus Availability ───────────────────────────────────
function EditBusForm({ bus, onClose, onSaved }: { bus: Bus; onClose?: () => void; onSaved: () => void }) {
  const [avail, setAvail] = useState(bus.is_available)
  const [cap, setCap] = useState(String(bus.capacity))
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    try {
      await api.fleet.updateBus(bus.id, { is_available: avail, capacity: Number(cap) })
      onSaved(); onClose?.()
    } catch (e: unknown) { setErr((e as Error).message) }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {err && <Alert message={err} />}
      <div><label className="label">Capacity</label><input className="input" type="number" value={cap} onChange={e => setCap(e.target.value)} /></div>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={avail} onChange={e => setAvail(e.target.checked)} className="w-4 h-4" />
        Available for service
      </label>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary">Save</button>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}

// ── Main ────────────────────────────────────────────────────
export default function DemandFleet() {
  const [buses, setBuses] = useState<Bus[]>([])
  const [demands, setDemands] = useState<Demand[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'buses' | 'demand'>('buses')

  const reload = () => {
    setLoading(true)
    Promise.all([api.fleet.buses(), api.fleet.demands(), api.network.routes()])
      .then(([b, d, r]) => { setBuses(b); setDemands(d); setRoutes(r) })
      .finally(() => setLoading(false))
  }
  useEffect(reload, [])

  // demand chart: group by time slot
  const demandBySlot = Object.entries(
    demands.reduce<Record<string, number>>((acc, d) => {
      acc[d.time_slot] = (acc[d.time_slot] || 0) + d.passengers
      return acc
    }, {})
  ).sort(([a], [b]) => a.localeCompare(b)).map(([slot, pax]) => ({ slot, pax }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Demand & Fleet</h1>
          <p className="text-slate-400 text-sm mt-1">Manage buses and passenger demand data</p>
        </div>
        <div className="flex gap-2">
          <button onClick={api.fleet.exportBuses} className="btn-secondary flex items-center gap-1"><Download size={14} /> Buses CSV</button>
          <button onClick={api.fleet.exportDemands} className="btn-secondary flex items-center gap-1"><Download size={14} /> Demand CSV</button>
        </div>
      </div>

      {/* Demand chart */}
      {demandBySlot.length > 0 && (
        <div className="card">
          <p className="section-title">Passenger Demand by Time Slot (all routes)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={demandBySlot}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2f5e" />
              <XAxis dataKey="slot" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#0a1228', border: '1px solid #1a2f5e', color: '#e2e8f0' }} />
              <Bar dataKey="pax" fill="#22d3ee" radius={[3, 3, 0, 0]} name="Passengers" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-navy-700">
        {[{ key: 'buses', label: `Fleet (${buses.length})` }, { key: 'demand', label: `Demand (${demands.length})` }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as 'buses' | 'demand')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === 'buses' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="section-title mb-0">Fleet</p>
              <Modal title="Add Bus" trigger={<button className="btn-primary flex items-center gap-1"><Plus size={14} /> Add Bus</button>}>
                <BusForm onSaved={reload} />
              </Modal>
            </div>
            <DataTable
              loading={loading} data={buses} emptyMsg="No buses."
              columns={[
                { key: 'number', label: 'Bus No.' },
                { key: 'capacity', label: 'Capacity' },
                { key: 'fuel_type', label: 'Fuel' },
                { key: 'operating_cost_per_km', label: 'Cost/km (₹)', render: b => b.operating_cost_per_km.toFixed(1) },
                { key: 'is_available', label: 'Available', render: b => b.is_available ? <span className="badge-green badge">Yes</span> : <span className="badge-red badge">No</span> },
              ]}
              actions={b => (
                <div className="flex gap-1">
                  <Modal title="Edit Bus" trigger={<button className="btn-secondary px-2 py-1 text-xs"><Edit2 size={12} /></button>}>
                    <EditBusForm bus={b} onSaved={reload} />
                  </Modal>
                  <button onClick={async () => { await api.fleet.deleteBus(b.id); reload() }} className="btn-danger px-2 py-1 text-xs"><Trash2 size={12} /></button>
                </div>
              )}
            />
          </>
        )}

        {activeTab === 'demand' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="section-title mb-0">Passenger Demand</p>
              <Modal title="Add Demand Record" trigger={<button className="btn-primary flex items-center gap-1"><Plus size={14} /> Add Demand</button>}>
                <DemandForm routes={routes} onSaved={reload} />
              </Modal>
            </div>
            <DataTable
              loading={loading} data={demands} emptyMsg="No demand records."
              columns={[
                { key: 'route_name', label: 'Route' },
                { key: 'time_slot', label: 'Time Slot' },
                { key: 'passengers', label: 'Passengers' },
                { key: 'peak_multiplier', label: 'Peak Mult.', render: d => d.peak_multiplier.toFixed(1) + '×' },
                { key: 'peak_multiplier', label: 'Effective Pax', render: d => Math.round(d.passengers * d.peak_multiplier) },
              ]}
              actions={d => (
                <button onClick={async () => { await api.fleet.deleteDemand(d.id); reload() }} className="btn-danger px-2 py-1 text-xs"><Trash2 size={12} /></button>
              )}
            />
          </>
        )}
      </div>
    </div>
  )
}
