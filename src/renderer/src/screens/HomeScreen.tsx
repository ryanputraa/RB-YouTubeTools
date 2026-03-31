import React, { useState, useRef } from 'react'
import type { VideoInfo } from '@shared/types'
import Logo from '../components/Logo'

interface HomeScreenProps {
  onVideoFetched: (info: VideoInfo) => void
}

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/

export default function HomeScreen({ onVideoFetched }: HomeScreenProps): JSX.Element {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFetch = async () => {
    const trimmed = url.trim()
    if (!trimmed) {
      setError('Please enter a YouTube URL.')
      return
    }
    if (!YOUTUBE_REGEX.test(trimmed)) {
      setError('That doesn\'t look like a valid YouTube URL.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await window.electronAPI.getVideoInfo(trimmed)
      if ('error' in result) {
        setError(result.message)
        return
      }
      onVideoFetched(result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFetch()
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (YOUTUBE_REGEX.test(text.trim())) {
        setUrl(text.trim())
        setError('')
      }
    } catch {}
  }

  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="max-w-lg w-full space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Logo className="h-20 w-auto" />
          </div>
          <h1 className="text-3xl font-bold text-white">
            RB YT Video Translator
          </h1>
          <p className="text-white/50">
            Translate YouTube captions into any language — instantly.
          </p>
        </div>

        {/* URL input */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError('') }}
              onKeyDown={handleKeyDown}
              placeholder="https://www.youtube.com/watch?v=..."
              className="input-field flex-1 text-sm"
              disabled={loading}
              autoFocus
            />
            <button
              onClick={handlePaste}
              className="btn-secondary text-sm px-3 shrink-0"
              title="Paste from clipboard"
              disabled={loading}
            >
              Paste
            </button>
          </div>

          <button
            onClick={handleFetch}
            disabled={loading || !url.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Fetching video info...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Fetch Video Info
              </>
            )}
          </button>

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
              <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Feature hints */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: '🎬', title: 'Auto Captions', desc: 'Uses YouTube auto-generated subtitles' },
            { icon: '🌍', title: '100+ Languages', desc: 'Translate to any language via Google Translate' },
            { icon: '💾', title: 'Save & Watch', desc: 'Export SRT files or watch with subtitles' }
          ].map((f) => (
            <div key={f.title} className="card text-center space-y-1.5">
              <div className="text-2xl">{f.icon}</div>
              <div className="text-white/80 text-xs font-medium">{f.title}</div>
              <div className="text-white/40 text-xs">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
