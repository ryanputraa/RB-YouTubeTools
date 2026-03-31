import React, { useState, useEffect } from 'react'
import type { VideoInfo } from '@shared/types'
import { LANGUAGES } from '../lib/languages'

interface OptionsScreenProps {
  videoInfo: VideoInfo
  onBack: () => void
  onStart: (jobId: string, opts: { downloadVideo: boolean; targetLang: string; outputDir: string }) => void
}

function formatDuration(seconds: number): string {
  if (!seconds) return 'Unknown'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function OptionsScreen({ videoInfo, onBack, onStart }: OptionsScreenProps): JSX.Element {
  const [targetLang, setTargetLang] = useState('es')
  const [downloadVideo, setDownloadVideo] = useState(false)
  const [outputDir, setOutputDir] = useState('')
  const [langSearch, setLangSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    window.electronAPI.getDefaultOutputDir().then(setOutputDir)
  }, [])

  const filteredLangs = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.nativeName.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.code.toLowerCase().includes(langSearch.toLowerCase())
  )

  const handleBrowse = async () => {
    const result = await window.electronAPI.selectOutputDir()
    if (!('cancelled' in result)) {
      setOutputDir(result.path)
    }
  }

  const handleStart = async () => {
    if (!outputDir) {
      setError('Please select an output folder.')
      return
    }
    setLoading(true)
    setError('')

    try {
      const result = await window.electronAPI.startJob({
        url: videoInfo.url,
        targetLang,
        downloadVideo,
        outputDir
      })

      if ('error' in result) {
        setError(result.message)
        setLoading(false)
        return
      }

      onStart(result.jobId, { downloadVideo, targetLang, outputDir })
    } catch (e) {
      setError((e as Error).message)
      setLoading(false)
    }
  }

  const selectedLang = LANGUAGES.find((l) => l.code === targetLang)

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-5">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors w-fit">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Video info card */}
      <div className="card flex gap-4">
        {videoInfo.thumbnailUrl && (
          <img
            src={videoInfo.thumbnailUrl}
            alt="Thumbnail"
            className="w-32 h-20 object-cover rounded-lg shrink-0"
          />
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <h2 className="font-semibold text-white leading-tight line-clamp-2">
            {videoInfo.title}
          </h2>
          <p className="text-white/50 text-sm">{videoInfo.channelName}</p>
          <p className="text-accent-green text-sm font-medium">
            {formatDuration(videoInfo.durationSeconds)}
          </p>
        </div>
      </div>

      {/* Options */}
      <div className="space-y-4">
        <h3 className="text-white/70 text-xs font-semibold uppercase tracking-wider">
          Translation Options
        </h3>

        {/* Language selector */}
        <div className="card space-y-3">
          <label className="text-sm font-medium text-white/80">Target Language</label>
          <input
            type="text"
            placeholder="Search languages..."
            value={langSearch}
            onChange={(e) => setLangSearch(e.target.value)}
            className="input-field text-sm"
          />
          <div className="max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-base">
            {filteredLangs.map((lang) => (
              <button
                key={lang.code}
                onClick={() => { setTargetLang(lang.code); setLangSearch('') }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                  targetLang === lang.code
                    ? 'bg-primary/20 text-accent-green'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span>{lang.name}</span>
                <span className="text-white/30 text-xs font-mono">{lang.nativeName}</span>
              </button>
            ))}
            {filteredLangs.length === 0 && (
              <p className="text-white/30 text-sm px-3 py-4 text-center">No languages found</p>
            )}
          </div>
          {selectedLang && !langSearch && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-white/50">Selected:</span>
              <span className="text-accent-green font-medium">{selectedLang.name}</span>
              <span className="text-white/30">({selectedLang.nativeName})</span>
            </div>
          )}
        </div>

        {/* Download video toggle */}
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">Download Video</p>
            <p className="text-xs text-white/40 mt-0.5">
              Also download the video file (larger, takes longer)
            </p>
          </div>
          <button
            onClick={() => setDownloadVideo(!downloadVideo)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
              downloadVideo ? 'bg-primary' : 'bg-white/10'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                downloadVideo ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Output folder */}
        <div className="card space-y-3">
          <label className="text-sm font-medium text-white/80">Output Folder</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={outputDir}
              readOnly
              placeholder="Select a folder..."
              className="input-field flex-1 text-sm cursor-pointer"
              onClick={handleBrowse}
            />
            <button onClick={handleBrowse} className="btn-secondary text-sm shrink-0">
              Browse
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
          <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={loading || !outputDir}
        className="btn-primary flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Starting...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start Translation
          </>
        )}
      </button>
    </div>
  )
}
