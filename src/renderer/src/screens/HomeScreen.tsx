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

function extractVideoId(u: string): string {
  const m = u.match(/[?&]v=([\w-]+)/) ?? u.match(/youtu\.be\/([\w-]+)/)
  return m ? m[1] : ''
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
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionIndex, setSuggestionIndex] = useState(-1)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Backfill then load recent history for inline cards
    window.electronAPI.backfillHistory().catch(() => {}).finally(() => {
      window.electronAPI.getHistory().then(setHistory)
    })
  }, [])

  useEffect(() => {
    if (!menuOpenId) return
    const handler = () => setMenuOpenId(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [menuOpenId])

  const urlHistory = loadUrlHistory()
  const suggestions = url.trim()
    ? urlHistory.filter((u) => u.toLowerCase().includes(url.trim().toLowerCase()))
    : urlHistory

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

      setShowSuggestions(false)
      onVideoFetched(result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setShowSuggestions(false); setSuggestionIndex(-1); return }

    if (e.key === 'Enter') {
      if (showSuggestions && suggestionIndex >= 0 && suggestions[suggestionIndex]) {
        const picked = suggestions[suggestionIndex]
        setUrl(picked)
        setShowSuggestions(false)
        setSuggestionIndex(-1)
        handleFetch(picked)
      } else {
        handleFetch()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (showSuggestions && suggestions.length > 0) {
        const next = Math.min(suggestionIndex + 1, suggestions.length - 1)
        setSuggestionIndex(next)
        setUrl(suggestions[next])
      }
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (showSuggestions && suggestionIndex > 0) {
        const next = suggestionIndex - 1
        setSuggestionIndex(next)
        setUrl(suggestions[next])
      }
      return
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim()) { setUrl(text.trim()); setError(''); setShowSuggestions(false) }
    } catch {}
  }

  const handleOpenEntry = (entry: HistoryEntry) => {
    onOpenResult({
      srtPath: entry.srtPath,
      vttPath: entry.vttPath,
      videoPath: entry.videoPath,
      outputDir: entry.outputDir,
      blockCount: entry.blockCount,
      videoTitle: entry.videoTitle,
      videoId: entry.videoId
    })
  }

  const handleDeleteEntry = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setMenuOpenId(null)
    await window.electronAPI.deleteEntryWithFolder(id)
    setHistory((prev) => prev.filter((h) => h.id !== id))
  }

  const handleCopyLink = (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation()
    setMenuOpenId(null)
    navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${videoId}`).catch(() => {})
  }

  const handleOpenFolder = (e: React.MouseEvent, outputDir: string) => {
    e.stopPropagation()
    setMenuOpenId(null)
    window.electronAPI.openFolder(outputDir)
  }

  const recentHistory = history.slice(0, 12)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* URL input — sticky at top */}
      <div className="px-5 pt-5 pb-4 space-y-3 border-b border-white/5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(''); setSuggestionIndex(-1) }}
              onFocus={() => { if (loadUrlHistory().length > 0) setShowSuggestions(true) }}
              onBlur={(e) => {
                // Delay so clicks on suggestions register first
                if (!suggestionsRef.current?.contains(e.relatedTarget as Node)) {
                  setShowSuggestions(false)
                  setSuggestionIndex(-1)
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Paste a YouTube URL..."
              className="input-field w-full text-sm"
              disabled={loading}
              autoFocus
            />
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute top-full left-0 right-0 mt-1 bg-base-card border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto"
              >
                {suggestions.map((u, i) => {
                  const vid = extractVideoId(u)
                  const entry = history.find((h) => h.videoId === vid)
                  return (
                    <button
                      key={u}
                      tabIndex={-1}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setUrl(u)
                        setShowSuggestions(false)
                        setSuggestionIndex(-1)
                        setTimeout(() => inputRef.current?.focus(), 0)
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2.5 ${
                        i === suggestionIndex
                          ? 'bg-primary/20 text-accent-green'
                          : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                      }`}
                    >
                      {entry?.thumbnailUrl ? (
                        <img src={entry.thumbnailUrl} alt="" className="w-8 h-5 object-cover rounded shrink-0 opacity-70" />
                      ) : (
                        <svg className="w-4 h-4 shrink-0 text-white/20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                        </svg>
                      )}
                      <span className="truncate">{entry?.videoTitle ?? u}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
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
              <div
                key={entry.id}
                className="group flex flex-col gap-2 cursor-pointer"
                onClick={() => handleOpenEntry(entry)}
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

                {/* Info + three-dot */}
                <div className="flex items-start gap-1 px-0.5">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-white text-sm font-medium leading-snug line-clamp-2 group-hover:text-white/90">{entry.videoTitle}</p>
                    <p className="text-white/40 text-xs">→ {langName(entry.targetLang)} · {formatDate(entry.date)}</p>
                  </div>

                  {/* Three-dot menu */}
                  <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === entry.id ? null : entry.id) }}
                      className="p-1 rounded text-white/0 group-hover:text-white/30 hover:!text-white/70 hover:bg-white/5 transition-colors"
                      title="More options"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                      </svg>
                    </button>

                    {menuOpenId === entry.id && (
                      <div
                        className="absolute right-0 top-full mt-1 w-44 bg-base-card border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden"
                        onBlur={() => setMenuOpenId(null)}
                      >
                        {entry.videoId && (
                          <button
                            onClick={(e) => handleCopyLink(e, entry.videoId)}
                            className="w-full text-left px-3 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                          >
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy YouTube link
                          </button>
                        )}
                        <button
                          onClick={(e) => handleOpenFolder(e, entry.outputDir)}
                          className="w-full text-left px-3 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                          </svg>
                          Open in Explorer
                        </button>
                        <button
                          onClick={(e) => handleDeleteEntry(e, entry.id)}
                          className="w-full text-left px-3 py-2.5 text-sm text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
