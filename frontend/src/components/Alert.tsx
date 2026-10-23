import React from 'react'

interface Props {
  message: string
  type?: 'error' | 'info' | 'success'
}

export function Alert({ message, type = 'error' }: Props) {
  const colors = {
    error: 'bg-red-900/50 border-red-700 text-red-300',
    info: 'bg-blue-900/50 border-blue-700 text-blue-300',
    success: 'bg-emerald-900/50 border-emerald-700 text-emerald-300',
  }
  return (
    <div className={`border rounded-lg px-4 py-3 text-sm ${colors[type]}`}>
      {message}
    </div>
  )
}
