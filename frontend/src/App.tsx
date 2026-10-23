import React, { useEffect, useState } from 'react'
import { HashRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Network,
  Bus as BusIcon,
  CalendarClock,
  Atom,
  BarChart3,
  FileSpreadsheet,
  Database,
  Radio,
  Layers,
  ExternalLink
} from 'lucide-react'

import Overview from './pages/Overview'
import TransportNetwork from './pages/TransportNetwork'
import DemandFleet from './pages/DemandFleet'
import ScheduleOptimizer from './pages/ScheduleOptimizer'
import QuantumLab from './pages/QuantumLab'
import Results from './pages/Results'
import Reports from './pages/Reports'
import DataManagement from './pages/DataManagement'
import { api } from './api'

function Layout({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState<boolean | null>(null)
  const location = useLocation()

  useEffect(() => {
    api.health()
      .then(res => setOnline(res.status === 'ok'))
      .catch(() => setOnline(false))

    const interval = setInterval(() => {
      api.health()
        .then(res => setOnline(res.status === 'ok'))
        .catch(() => setOnline(false))
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/network', label: 'Transport Network', icon: Network },
    { to: '/fleet', label: 'Demand & Fleet', icon: BusIcon },
    { to: '/optimizer', label: 'Schedule Optimizer', icon: CalendarClock },
    { to: '/quantum-lab', label: 'Quantum Lab', icon: Atom },
    { to: '/results', label: 'Results & Metrics', icon: BarChart3 },
    { to: '/reports', label: 'Reports & Export', icon: FileSpreadsheet },
    { to: '/data', label: 'Data Management', icon: Database },
  ]

  return (
    <div className="flex min-h-screen bg-navy-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-navy-950">
      {/* Sidebar */}
      <aside className="w-64 border-r border-navy-800 bg-navy-900/90 flex flex-col shrink-0 sticky top-0 h-screen z-20">
        <div className="p-5 border-b border-navy-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-black tracking-wider">
              TQ
            </div>
            <div>
              <div className="font-bold text-white text-base tracking-tight flex items-center gap-1.5">
                TransitQ
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">v1.0</span>
              </div>
              <div className="text-[11px] text-slate-400">GPREC Transport Optimizer</div>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Navigation
          </div>
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.to
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.1)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/80'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-cyan-400' : 'text-slate-500'} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* System info footer */}
        <div className="p-4 border-t border-navy-800 space-y-3 bg-navy-950/40">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Radio size={12} className={online ? 'text-emerald-400 animate-pulse' : 'text-red-400'} />
              Backend API
            </span>
            <span className={online ? 'text-emerald-400 font-mono text-[11px]' : 'text-red-400 font-mono text-[11px]'}>
              {online === null ? 'Checking...' : online ? 'Connected' : 'Offline'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>Domain:</span>
              <span className="text-slate-400">QAIC 2027</span>
            </div>
            <div className="flex justify-between">
              <span>Hardware:</span>
              <span className="text-slate-400">Classical (CPU SA)</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Body */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 border-b border-navy-800 bg-navy-900/60 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-slate-300 font-medium">
              <Layers size={14} className="text-cyan-400" />
              G. Pulla Reddy Engineering College, Kurnool
            </span>
            <span className="text-navy-700">|</span>
            <span className="badge badge-yellow">Synthetic Benchmark Dataset</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="text-slate-400">
              Target: <span className="text-slate-200">Bus Fleet & Timetable Dispatch</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-8 flex-1 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/network" element={<TransportNetwork />} />
          <Route path="/fleet" element={<DemandFleet />} />
          <Route path="/optimizer" element={<ScheduleOptimizer />} />
          <Route path="/quantum-lab" element={<QuantumLab />} />
          <Route path="/results" element={<Results />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/data" element={<DataManagement />} />
        </Routes>
      </Layout>
    </Router>
  )
}
