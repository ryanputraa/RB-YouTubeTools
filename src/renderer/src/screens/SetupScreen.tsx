import React, { useState } from 'react'
import Logo from '../components/Logo'

interface SetupScreenProps {
  onComplete: () => void
}

export default function SetupScreen({ onComplete }: SetupScreenProps): JSX.Element {
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState('')
  const [error, setError] = useState('')

  const handleAutoDownload = async () => {
    setDownloading(true)
    setError('')

    try {
      const result = await window.electronAPI.downloadYtdlp((pct, msg) => {
        setProgress(pct)
        setProgressMsg(msg)
      })

      if ('error' in result) {
        setError(result.message)
        setDownloading(false)
        return
      }

      // Verify it works
      const status = await window.electronAPI.checkYtdlp()
      if (status.found) {
        onComplete()
      } else {
        setError('Download completed but yt-dlp could not be verified.')
        setDownloading(false)
      }
    } catch (e) {
      setError((e as Error).message)
      setDownloading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <Logo className="h-16 w-auto" />
          </div>
          <h1 className="text-2xl font-bold text-white">Setup Required</h1>
          <p className="text-white/50 text-sm">
            This app requires <strong className="text-accent-green">yt-dlp</strong> to download
            YouTube captions and videos.
          </p>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-white/90">Option 1 — Auto Download</h2>
          <p className="text-white/50 text-sm">
            Download yt-dlp automatically from the official GitHub releases.
          </p>

          {downloading ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-white/60">
                <span>{progressMsg || 'Downloading...'}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-base-light rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <button onClick={handleAutoDownload} className="btn-primary w-full">
              Download yt-dlp Automatically
            </button>
          )}

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="card space-y-3">
          <h2 className="font-semibold text-white/90">Option 2 — Manual Install</h2>
          <p className="text-white/50 text-sm">
            Install yt-dlp yourself and make sure it's available in your system PATH.
          </p>
          <ol className="text-white/60 text-sm space-y-1 list-decimal list-inside">
            <li>
              Visit{' '}
              <span className="text-accent-blue font-mono text-xs">
                github.com/yt-dlp/yt-dlp/releases
              </span>
            </li>
            <li>Download the binary for your OS</li>
            <li>Add it to your system PATH</li>
            <li>Restart this application</li>
          </ol>
          <button
            onClick={() => window.electronAPI.checkYtdlp().then((s) => s.found && onComplete())}
            className="btn-secondary w-full text-sm"
          >
            Check Again
          </button>
        </div>
      </div>
    </div>
  )
}
