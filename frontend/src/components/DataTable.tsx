import React from 'react'

interface Column<T> {
  key: keyof T | string
  label: string
  render?: (row: T) => React.ReactNode
}

interface Props<T extends object> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMsg?: string
  actions?: (row: T) => React.ReactNode
}

export function DataTable<T extends object>({ columns, data, loading, emptyMsg = 'No data', actions }: Props<T>) {
  if (loading) {
    return (
      <div className="text-center py-12 text-slate-500 animate-pulse">Loading…</div>
    )
  }
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">{emptyMsg}</div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-navy-700">
            {columns.map(c => (
              <th key={String(c.key)} className="table-header">{c.label}</th>
            ))}
            {actions && <th className="table-header text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="table-row">
              {columns.map(c => (
                <td key={String(c.key)} className="table-cell">
                  {c.render
                    ? c.render(row)
                    : String((row as Record<string, unknown>)[c.key as string] ?? '—')}
                </td>
              ))}
              {actions && (
                <td className="table-cell text-right">{actions(row)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
