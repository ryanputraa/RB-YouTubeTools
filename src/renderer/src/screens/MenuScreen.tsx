import React from 'react'
import Logo from '../components/Logo'

interface MenuScreenProps {
  onSelect: (tool: 'translator') => void
}

export default function MenuScreen({ onSelect }: MenuScreenProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 space-y-10">
      {/* Branding */}
      <div className="flex flex-col items-center gap-3">
        <Logo className="h-14 w-auto" />
        <h1 className="text-2xl font-bold text-white tracking-tight">RB YouTube Tools</h1>
        <p className="text-white/40 text-sm">Open source YouTube utilities</p>
      </div>

      {/* Tool grid */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
        <button
          onClick={() => onSelect('translator')}
          className="card flex flex-col gap-3 text-left hover:bg-white/8 hover:border-white/15 transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
            <svg className="w-5 h-5 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Caption Translator</p>
            <p className="text-xs text-white/40 mt-0.5">Download and translate YouTube captions</p>
          </div>
        </button>

        {/* Placeholder for future tools */}
        <div className="card flex flex-col gap-3 text-left opacity-30 cursor-not-allowed">
          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
            <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white/50">More coming soon</p>
            <p className="text-xs text-white/25 mt-0.5">More tools in development</p>
          </div>
        </div>
      </div>
    </div>
  )
}
