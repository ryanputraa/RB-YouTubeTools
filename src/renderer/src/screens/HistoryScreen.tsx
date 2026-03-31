import React, { useState, useEffect } from 'react'
import type { HistoryEntry, JobResult } from '@shared/types'
import { LANGUAGES } from '../lib/languages'

interface HistoryScreenProps {
  onBack: () => void
  onOpenResult: (result: JobResult) => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function langName(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code
}

export default function HistoryScreen({ onBack, onOpenResult }: HistoryScreenProps): JSX.Element {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.electronAPI.getHistory().then((h) => { setEntries(h); setLoading(false) })
  }, [])

  const handleDelete = async (id: string) => {
    await window.electronAPI.deleteHistoryEntry(id)
    setEntries((e) => e.filter((x) => x.id !== id))
  }

  const handleClear = async () => {
    await window.electronAPI.clearHistory()
    setEntries([])
  }

  const handleOpen = (entry: HistoryEntry) => {
    onOpenResult({
      srtPath: entry.srtPath,
      vttPath: entry.vttPath,
      videoPath: entry.videoPath,
      outputDir: entry.outputDir,
      blockCount: entry.blockCount,
      videoTitle: entry.videoTitle
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-white/40 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="font-semibold text-white text-sm">Translation History</h2>
        </div>
        {entries.length > 0 && (
          <button onClick={handleClear} className="text-xs text-white/30 hover:text-red-400 transition-colors">
            Clear all
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
            <svg className="w-10 h-10 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-white/30 text-sm">No translations yet</p>
          </div>
        )}

        {entries.map((entry) => {
          const filesExist = entry.srtPath || entry.vttPath
          const videoExists = !!entry.videoPath

          return (
            <div key={entry.id} className="card flex gap-3 group">
              {/* Thumbnail */}
              {entry.thumbnailUrl ? (
                <img
                  src={entry.thumbnailUrl}
                  alt=""
                  className="w-20 h-12 object-cover rounded shrink-0"
                />
              ) : (
                <div className="w-20 h-12 bg-white/5 rounded shrink-0 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-white text-sm font-medium leading-tight line-clamp-1">{entry.videoTitle}</p>
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <span>→ {langName(entry.targetLang)}</span>
                  <span>·</span>
                  <span>{entry.blockCount} blocks</span>
                  {videoExists && (
                    <>
                      <span>·</span>
                      <span className="text-accent-green/70">video</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-white/25">{formatDate(entry.date)}</p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {filesExist && (
                  <button
                    onClick={() => handleOpen(entry)}
                    className="text-xs px-2 py-1 rounded bg-primary/20 text-accent-green hover:bg-primary/30 transition-colors"
                  >
                    {videoExists ? 'Watch' : 'View'}
                  </button>
                )}
                <button
                  onClick={() => window.electronAPI.openFolder(entry.outputDir)}
                  className="text-xs px-2 py-1 rounded bg-white/5 text-white/50 hover:bg-white/10 transition-colors"
                >
                  Folder
                </button>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="text-xs px-2 py-1 rounded bg-white/5 text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
