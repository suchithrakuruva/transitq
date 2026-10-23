import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { Alert } from '../components/Alert'
import { Upload, RefreshCw, AlertTriangle, CheckCircle, FileText, Database } from 'lucide-react'

interface DataStatus {
  dataset_type: string
  is_synthetic: boolean
  disclaimer: string
  counts: {
    stops: number
    connections: number
    routes: number
    buses: number
    demands: number
    solver_runs: number
  }
}

export default function DataManagement() {
  const [status, setStatus] = useState<DataStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [errorsList, setErrorsList] = useState<string[]>([])

  const loadStatus = () => {
    setLoading(true)
    api.data.status()
      .then(s => setStatus(s))
      .catch(e => setUploadMsg({ type: 'error', text: e.message }))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const handleReset = async () => {
    if (!window.confirm("Are you sure you want to reset all data to the synthetic GPREC baseline dataset? Existing optimizer runs and custom imports will be cleared.")) {
      return
    }
    setResetting(true)
    setUploadMsg(null)
    setErrorsList([])
    try {
      const res = await api.data.resetDemo()
      setUploadMsg({ type: 'success', text: res.message })
      loadStatus()
    } catch (e: unknown) {
      setUploadMsg({ type: 'error', text: (e as Error).message })
    } finally {
      setResetting(false)
    }
  }

  const handleFileUpload = async (type: 'stops' | 'buses' | 'demands', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadMsg(null)
    setErrorsList([])
    try {
      let res: { imported: number; errors: string[] }
      if (type === 'stops') {
        res = await api.data.importStops(file)
      } else if (type === 'buses') {
        res = await api.data.importBuses(file)
      } else {
        res = await api.data.importDemands(file)
      }

      setUploadMsg({
        type: res.imported > 0 ? 'success' : 'error',
        text: `Successfully imported ${res.imported} new ${type} records. ${res.errors.length > 0 ? `(${res.errors.length} rows skipped with errors)` : ''}`
      })
      if (res.errors.length > 0) {
        setErrorsList(res.errors)
      }
      loadStatus()
    } catch (err: unknown) {
      setUploadMsg({ type: 'error', text: (err as Error).message })
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Data Management & Provenance</h1>
          <p className="text-slate-400 text-sm mt-1">Manage dataset provenance, CSV imports, and benchmark baselines</p>
        </div>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="btn-secondary flex items-center gap-2 border-cyan-800 text-cyan-300 hover:bg-cyan-950/40"
        >
          <RefreshCw size={14} className={resetting ? 'animate-spin' : ''} />
          {resetting ? 'Resetting...' : 'Reset to GPREC Demo Data'}
        </button>
      </div>

      {uploadMsg && (
        <Alert message={uploadMsg.text} type={uploadMsg.type} />
      )}

      {errorsList.length > 0 && (
        <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-4 text-xs text-red-300 space-y-1">
          <p className="font-semibold mb-2">Import Warnings / Errors:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {errorsList.slice(0, 10).map((err, i) => (
              <li key={i}>{err}</li>
            ))}
            {errorsList.length > 10 && <li>...and {errorsList.length - 10} more errors.</li>}
          </ul>
        </div>
      )}

      {/* Provenance Card */}
      <div className="card space-y-4">
        <div className="flex items-start gap-3">
          <Database className="text-cyan-400 mt-1 shrink-0" size={20} />
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-white">Dataset Provenance & Classification</h2>
              <span className="badge badge-yellow">Synthetic Benchmark</span>
            </div>
            <p className="text-sm text-slate-300">
              {status?.disclaimer || "All baseline demo entries are synthetic approximations for QAIC 2027 and not verified real-world GPREC schedules."}
            </p>
            <div className="flex flex-wrap gap-4 pt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Stops: {status?.counts.stops ?? '—'}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Connections: {status?.counts.connections ?? '—'}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Routes: {status?.counts.routes ?? '—'}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Buses: {status?.counts.buses ?? '—'}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Demand Records: {status?.counts.demands ?? '—'}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Solver Runs: {status?.counts.solver_runs ?? '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* CSV Import Panels */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Stops Import */}
        <div className="card space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText size={16} className="text-cyan-400" />
              <h3 className="font-semibold text-white text-sm">Import Stops CSV</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Upload stops with schema: <code>name, code, latitude, longitude, is_terminal, description</code>. Duplicate codes are skipped.
            </p>
          </div>
          <div>
            <label className="btn-secondary flex items-center justify-center gap-2 cursor-pointer w-full text-center py-2.5">
              <Upload size={14} /> Upload Stops CSV
              <input type="file" accept=".csv" className="hidden" onChange={e => handleFileUpload('stops', e)} />
            </label>
          </div>
        </div>

        {/* Buses Import */}
        <div className="card space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText size={16} className="text-cyan-400" />
              <h3 className="font-semibold text-white text-sm">Import Fleet (Buses) CSV</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Upload buses with schema: <code>number, capacity, fuel_type, operating_cost_per_km, is_available</code>.
            </p>
          </div>
          <div>
            <label className="btn-secondary flex items-center justify-center gap-2 cursor-pointer w-full text-center py-2.5">
              <Upload size={14} /> Upload Buses CSV
              <input type="file" accept=".csv" className="hidden" onChange={e => handleFileUpload('buses', e)} />
            </label>
          </div>
        </div>

        {/* Demand Import */}
        <div className="card space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText size={16} className="text-cyan-400" />
              <h3 className="font-semibold text-white text-sm">Import Demand CSV</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Upload demand with schema: <code>route_code, time_slot (HH:MM), passengers, peak_multiplier</code>.
            </p>
          </div>
          <div>
            <label className="btn-secondary flex items-center justify-center gap-2 cursor-pointer w-full text-center py-2.5">
              <Upload size={14} /> Upload Demand CSV
              <input type="file" accept=".csv" className="hidden" onChange={e => handleFileUpload('demands', e)} />
            </label>
          </div>
        </div>
      </div>

      {/* CSV Schema reference */}
      <div className="card space-y-3">
        <p className="section-title mb-1">Standard Schema Reference for Validated Ingestion</p>
        <div className="grid md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="bg-navy-950 p-3 rounded-lg border border-navy-800">
            <span className="text-cyan-400 font-bold block mb-1">stops.csv</span>
            name,code,latitude,longitude,is_terminal,description<br />
            GPREC Main Gate,GMG,15.8320,78.0520,true,Main gate
          </div>
          <div className="bg-navy-950 p-3 rounded-lg border border-navy-800">
            <span className="text-cyan-400 font-bold block mb-1">buses.csv</span>
            number,capacity,fuel_type,operating_cost_per_km,is_available<br />
            AP-09-TC-9999,50,Electric,7.5,true
          </div>
          <div className="bg-navy-950 p-3 rounded-lg border border-navy-800">
            <span className="text-cyan-400 font-bold block mb-1">demands.csv</span>
            route_code,time_slot,passengers,peak_multiplier<br />
            CC-AM,08:30,45,1.5
          </div>
        </div>
      </div>
    </div>
  )
}
