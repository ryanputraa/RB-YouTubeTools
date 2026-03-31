import React, { useState, useEffect } from 'react'
import Logo from '../components/Logo'

interface SetupScreenProps {
  onComplete: () => void
}

type ToolStatus = 'checking' | 'found' | 'missing' | 'downloading' | 'done' | 'error'

interface ToolState {
  status: ToolStatus
  progress: number
  progressMsg: string
  error: string
}

export default function SetupScreen({ onComplete }: SetupScreenProps): JSX.Element {
  const [ytdlp, setYtdlp] = useState<ToolState>({ status: 'checking', progress: 0, progressMsg: '', error: '' })
  const [ffmpeg, setFfmpeg] = useState<ToolState>({ status: 'checking', progress: 0, progressMsg: '', error: '' })

  useEffect(() => {
    Promise.all([
      window.electronAPI.checkYtdlp(),
      window.electronAPI.checkFfmpeg()
    ]).then(([yt, ff]) => {
      setYtdlp((s) => ({ ...s, status: yt.found ? 'found' : 'missing' }))
      setFfmpeg((s) => ({ ...s, status: ff.found ? 'found' : 'missing' }))
    })
  }, [])

  // Auto-proceed when both are ready
  useEffect(() => {
    const ytOk = ytdlp.status === 'found' || ytdlp.status === 'done'
    const ffOk = ffmpeg.status === 'found' || ffmpeg.status === 'done'
    if (ytOk && ffOk) {
      const t = setTimeout(() => onComplete(), 600)
      return () => clearTimeout(t)
    }
  }, [ytdlp.status, ffmpeg.status])

  const downloadYtdlp = async () => {
    setYtdlp((s) => ({ ...s, status: 'downloading', error: '' }))
    try {
      const result = await window.electronAPI.downloadYtdlp((pct, msg) => {
        setYtdlp((s) => ({ ...s, progress: pct, progressMsg: msg }))
      })
      if ('error' in result) {
        setYtdlp((s) => ({ ...s, status: 'error', error: result.message }))
      } else {
        setYtdlp((s) => ({ ...s, status: 'done', progress: 100 }))
      }
    } catch (e) {
      setYtdlp((s) => ({ ...s, status: 'error', error: (e as Error).message }))
    }
  }

  const downloadFfmpeg = async () => {
    setFfmpeg((s) => ({ ...s, status: 'downloading', error: '' }))
    try {
      const result = await window.electronAPI.downloadFfmpeg((pct, msg) => {
        setFfmpeg((s) => ({ ...s, progress: pct, progressMsg: msg }))
      })
      if ('error' in result) {
        setFfmpeg((s) => ({ ...s, status: 'error', error: result.message }))
      } else {
        setFfmpeg((s) => ({ ...s, status: 'done', progress: 100 }))
      }
    } catch (e) {
      setFfmpeg((s) => ({ ...s, status: 'error', error: (e as Error).message }))
    }
  }

  const skipFfmpeg = () => {
    setFfmpeg((s) => ({ ...s, status: 'done' }))
  }

  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <Logo className="h-16 w-auto" />
          </div>
          <h1 className="text-2xl font-bold text-white">First-Time Setup</h1>
          <p className="text-white/50 text-sm">
            Two tools are needed to extract and process captions.
          </p>
        </div>

        <ToolCard
          name="yt-dlp"
          description="Downloads YouTube captions and videos"
          required
          state={ytdlp}
          onDownload={downloadYtdlp}
        />

        <ToolCard
          name="ffmpeg"
          description="Required for merging fragmented caption streams"
          required={false}
          state={ffmpeg}
          onDownload={downloadFfmpeg}
          onSkip={skipFfmpeg}
          skipLabel="Skip (some videos may fail)"
        />

        <p className="text-white/30 text-xs text-center">
          Both tools are stored in your user data folder and never modify your system.
        </p>
      </div>
    </div>
  )
}

interface ToolCardProps {
  name: string
  description: string
  required: boolean
  state: ToolState
  onDownload: () => void
  onSkip?: () => void
  skipLabel?: string
}

function ToolCard({ name, description, required, state, onDownload, onSkip, skipLabel }: ToolCardProps): JSX.Element {
  const isReady = state.status === 'found' || state.status === 'done'
  const isDownloading = state.status === 'downloading'
  const isMissing = state.status === 'missing' || state.status === 'error'

  return (
    <div className={`card space-y-3 border ${isReady ? 'border-primary/30' : 'border-white/10'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white font-mono">{name}</span>
            {required && <span className="text-xs text-white/30 bg-white/5 px-1.5 py-0.5 rounded">required</span>}
          </div>
          <p className="text-white/50 text-xs mt-0.5">{description}</p>
        </div>
        <StatusBadge status={state.status} />
      </div>

      {isDownloading && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-white/50">
            <span>{state.progressMsg || 'Downloading...'}</span>
            <span>{state.progress}%</span>
          </div>
          <div className="w-full bg-base-light rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${state.progress}%` }}
            />
          </div>
        </div>
      )}

      {state.error && (
        <p className="text-red-400 text-xs bg-red-500/10 rounded px-2 py-1.5">{state.error}</p>
      )}

      {isMissing && (
        <div className="flex gap-2">
          <button onClick={onDownload} className="btn-primary text-sm flex-1">
            Download {name}
          </button>
          {onSkip && (
            <button onClick={onSkip} className="btn-secondary text-xs px-3">
              {skipLabel ?? 'Skip'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: ToolStatus }): JSX.Element {
  if (status === 'checking') return (
    <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin shrink-0 mt-1" />
  )
  if (status === 'found' || status === 'done') return (
    <svg className="w-5 h-5 text-accent-green shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
  if (status === 'downloading') return (
    <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin shrink-0 mt-1" />
  )
  return (
    <svg className="w-5 h-5 text-white/30 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  )
}
