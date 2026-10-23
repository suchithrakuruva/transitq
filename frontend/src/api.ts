/**
 * TransitQ API client – all calls go through Vite's /api proxy → http://localhost:8000
 */

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface Stop {
  id: number; name: string; code: string;
  latitude?: number; longitude?: number;
  description?: string; is_terminal: boolean; created_at: string;
}
export interface Connection {
  id: number; from_stop_id: number; to_stop_id: number;
  distance_km: number; travel_time_min: number; is_bidirectional: boolean;
  from_stop_name?: string; to_stop_name?: string; created_at: string;
}
export interface Route {
  id: number; name: string; code: string; stop_sequence: number[];
  total_distance_km: number; estimated_duration_min: number;
  is_active: boolean; created_at: string;
}
export interface Bus {
  id: number; number: string; capacity: number; is_available: boolean;
  depot_stop_id?: number; fuel_type: string;
  operating_cost_per_km: number; created_at: string;
}
export interface Demand {
  id: number; route_id: number; time_slot: string; passengers: number;
  peak_multiplier: number; route_name?: string; created_at: string;
}
export interface Trip {
  id: number; route_id: number; bus_id: number;
  departure_time: string; arrival_time: string;
  passengers_served: number; status: string;
  route_name?: string; bus_number?: string;
  solver_run_id?: number; created_at: string;
}
export interface SolverRun {
  id: number; solver_type: string; status: string;
  runtime_seconds?: number; total_trips: number;
  demand_served: number; total_demand: number;
  avg_waiting_time_min?: number; operating_cost?: number;
  vehicle_utilization?: number; feasible?: boolean;
  parameters?: Record<string, unknown>;
  result_summary?: Record<string, unknown>;
  created_at: string;
}
export interface OverviewMetrics {
  total_routes: number; total_stops: number;
  total_buses: number; available_buses: number; total_demand: number;
  latest_run_id?: number; latest_avg_waiting_time?: number;
  latest_demand_served?: number; latest_vehicle_utilization?: number;
  latest_operating_cost?: number; latest_feasible?: boolean;
  solver_runs_count: number;
}
export type CompareResult = Record<string, {
  id: number; runtime_seconds: number; demand_served: number;
  total_demand: number; avg_waiting_time_min: number;
  operating_cost: number; vehicle_utilization: number;
  feasible: boolean; total_trips: number; created_at: string;
}>

// ── API Methods ────────────────────────────────────────────────────────────

export const api = {
  health: () => request<{ status: string }>('/health'),

  overview: {
    metrics: () => request<OverviewMetrics>('/overview/metrics'),
  },

  network: {
    stops: () => request<Stop[]>('/network/stops'),
    createStop: (d: Omit<Stop, 'id' | 'created_at'>) =>
      request<Stop>('/network/stops', { method: 'POST', body: JSON.stringify(d) }),
    updateStop: (id: number, d: Partial<Stop>) =>
      request<Stop>(`/network/stops/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    deleteStop: (id: number) =>
      request<{ ok: boolean }>(`/network/stops/${id}`, { method: 'DELETE' }),

    connections: () => request<Connection[]>('/network/connections'),
    createConnection: (d: Omit<Connection, 'id' | 'created_at' | 'from_stop_name' | 'to_stop_name'>) =>
      request<Connection>('/network/connections', { method: 'POST', body: JSON.stringify(d) }),
    deleteConnection: (id: number) =>
      request<{ ok: boolean }>(`/network/connections/${id}`, { method: 'DELETE' }),

    routes: () => request<Route[]>('/network/routes'),
    createRoute: (d: Omit<Route, 'id' | 'created_at'>) =>
      request<Route>('/network/routes', { method: 'POST', body: JSON.stringify(d) }),
    updateRoute: (id: number, d: Partial<Route>) =>
      request<Route>(`/network/routes/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    deleteRoute: (id: number) =>
      request<{ ok: boolean }>(`/network/routes/${id}`, { method: 'DELETE' }),

    exportStops: () => window.open(`${BASE}/network/export/stops`, '_blank'),
    exportRoutes: () => window.open(`${BASE}/network/export/routes`, '_blank'),
  },

  fleet: {
    buses: () => request<Bus[]>('/fleet/buses'),
    createBus: (d: Omit<Bus, 'id' | 'created_at'>) =>
      request<Bus>('/fleet/buses', { method: 'POST', body: JSON.stringify(d) }),
    updateBus: (id: number, d: Partial<Bus>) =>
      request<Bus>(`/fleet/buses/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    deleteBus: (id: number) =>
      request<{ ok: boolean }>(`/fleet/buses/${id}`, { method: 'DELETE' }),

    demands: () => request<Demand[]>('/fleet/demands'),
    createDemand: (d: Omit<Demand, 'id' | 'created_at' | 'route_name'>) =>
      request<Demand>('/fleet/demands', { method: 'POST', body: JSON.stringify(d) }),
    updateDemand: (id: number, d: Partial<Demand>) =>
      request<Demand>(`/fleet/demands/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    deleteDemand: (id: number) =>
      request<{ ok: boolean }>(`/fleet/demands/${id}`, { method: 'DELETE' }),

    exportBuses: () => window.open(`${BASE}/fleet/export/buses`, '_blank'),
    exportDemands: () => window.open(`${BASE}/fleet/export/demands`, '_blank'),
  },

  optimizer: {
    run: (solver_type: string, parameters?: Record<string, unknown>) =>
      request<SolverRun>('/optimize/run', {
        method: 'POST',
        body: JSON.stringify({ solver_type, parameters }),
      }),
    runs: () => request<SolverRun[]>('/optimize/runs'),
    getRun: (id: number) => request<SolverRun>(`/optimize/runs/${id}`),
    getTrips: (id: number) => request<Trip[]>(`/optimize/runs/${id}/trips`),
    compare: () => request<CompareResult>('/optimize/compare'),
    exportSchedule: (id: number) => window.open(`${BASE}/optimize/export/schedule/${id}`, '_blank'),
    exportResults: (id: number) => window.open(`${BASE}/optimize/export/results/${id}`, '_blank'),
  },

  data: {
    status: () => request<{
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
    }>('/data/status'),
    resetDemo: () => request<{ status: string; message: string }>('/data/reset-demo', { method: 'POST' }),
    importStops: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return upload<{ imported: number; errors: string[] }>('/data/import/stops', fd)
    },
    importBuses: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return upload<{ imported: number; errors: string[] }>('/data/import/buses', fd)
    },
    importDemands: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return upload<{ imported: number; errors: string[] }>('/data/import/demands', fd)
    },
  },
}
