import React, { useState, useRef, useEffect } from 'react'
import type { VideoInfo, HistoryEntry, JobResult } from '@shared/types'
import { LANGUAGES } from '../lib/languages'

interface HomeScreenProps {
  onVideoFetched: (info: VideoInfo) => void
  onOpenResult: (result: JobResult) => void
}

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/
const URL_HISTORY_KEY = 'rb-yt-url-history'
const MAX_URL_HISTORY = 20

function loadUrlHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(URL_HISTORY_KEY) || '[]') } catch { return [] }
}

function saveUrlHistory(urls: string[]) {
  localStorage.setItem(URL_HISTORY_KEY, JSON.stringify(urls.slice(0, MAX_URL_HISTORY)))
}

function langName(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function HomeScreen({ onVideoFetched, onOpenResult }: HomeScreenProps): JSX.Element {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const historyIndexRef = useRef(-1)

  useEffect(() => {
    // Backfill then load recent history for inline cards
    window.electronAPI.backfillHistory().catch(() => {}).finally(() => {
      window.electronAPI.getHistory().then(setHistory)
    })
  }, [])

  const handleFetch = async (targetUrl?: string) => {
    const trimmed = (targetUrl ?? url).trim()
    if (!trimmed) { setError('Please enter a YouTube URL.'); return }
    if (!YOUTUBE_REGEX.test(trimmed)) { setError("That doesn't look like a valid YouTube URL."); return }

    setLoading(true)
    setError('')

    try {
      const result = await window.electronAPI.getVideoInfo(trimmed)
      if ('error' in result) { setError(result.message); return }

      // Save to URL history
      const hist = loadUrlHistory().filter((u) => u !== trimmed)
      hist.unshift(trimmed)
      saveUrlHistory(hist)
      historyIndexRef.current = -1

      onVideoFetched(result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { handleFetch(); return }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const urlHist = loadUrlHistory()
      if (urlHist.length === 0) return
      let next = historyIndexRef.current
      if (e.key === 'ArrowUp') next = Math.min(next + 1, urlHist.length - 1)
      else next = Math.max(next - 1, -1)
      historyIndexRef.current = next
      setUrl(next === -1 ? '' : urlHist[next])
      setError('')
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim()) { setUrl(text.trim()); setError('') }
    } catch {}
  }

  const handleOpenEntry = (entry: HistoryEntry) => {
    onOpenResult({
      srtPath: entry.srtPath,
      vttPath: entry.vttPath,
      videoPath: entry.videoPath,
      outputDir: entry.outputDir,
      blockCount: entry.blockCount,
      videoTitle: entry.videoTitle
    })
  }

  const recentHistory = history.slice(0, 12)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* URL input — sticky at top */}
      <div className="px-5 pt-5 pb-4 space-y-3 border-b border-white/5">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(''); historyIndexRef.current = -1 }}
            onKeyDown={handleKeyDown}
            placeholder="Paste a YouTube URL..."
            className="input-field flex-1 text-sm"
            disabled={loading}
            autoFocus
          />
          <button onClick={handlePaste} className="btn-secondary text-sm px-3 shrink-0" disabled={loading}>
            Paste
          </button>
          <button
            onClick={() => handleFetch()}
            disabled={loading || !url.trim()}
            className="btn-primary text-sm px-4 shrink-0 flex items-center gap-1.5"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            {loading ? 'Fetching...' : 'Fetch'}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Recent translations — YouTube-style grid */}
      {recentHistory.length > 0 && (
        <div className="flex-1 p-5">
          <h3 className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-4">Recent</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {recentHistory.map((entry) => (
              <button
                key={entry.id}
                onClick={() => handleOpenEntry(entry)}
                className="text-left group flex flex-col gap-2"
              >
                {/* Thumbnail — 16:9 */}
                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-white/5">
                  {entry.thumbnailUrl ? (
                    <img
                      src={entry.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                      </svg>
                    </div>
                  )}
                  {/* Badges */}
                  <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                    {entry.videoPath && (
                      <span className="bg-black/80 text-accent-green text-xs px-1.5 py-0.5 rounded font-medium">▶</span>
                    )}
                  </div>
                </div>

                {/* Info below thumbnail */}
                <div className="space-y-0.5 px-0.5">
                  <p className="text-white text-sm font-medium leading-snug line-clamp-2 group-hover:text-white/90">{entry.videoTitle}</p>
                  <p className="text-white/40 text-xs">→ {langName(entry.targetLang)} · {formatDate(entry.date)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {recentHistory.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/20 text-sm">Paste a URL above to get started</p>
        </div>
      )}
    </div>
  )
}
