import React, { useState, ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  trigger: ReactNode
  title: string
  children: ReactNode
}

export function Modal({ trigger, title, children }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 bg-navy-900 border border-navy-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-navy-700">
              <h3 className="font-semibold text-white">{title}</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              {React.cloneElement(children as React.ReactElement<{ onClose?: () => void }>, {
                onClose: () => setOpen(false)
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
