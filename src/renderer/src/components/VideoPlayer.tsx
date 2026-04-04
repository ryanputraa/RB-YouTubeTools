import React, { useRef, useEffect, useState } from 'react'

interface VideoPlayerProps {
  videoUrl: string
  vttContent: string
  originalVttContent?: string
}

function useBlobUrl(content: string) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!content) { setUrl(''); return }
    const blob = new Blob([content], { type: 'text/vtt' })
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [content])
  return url
}

export default function VideoPlayer({ videoUrl, vttContent, originalVttContent }: VideoPlayerProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const translatedUrl = useBlobUrl(vttContent)
  const originalUrl = useBlobUrl(originalVttContent ?? '')

  const [captionsOn, setCaptionsOn] = useState(true)
  const [activeTrack, setActiveTrack] = useState<'translated' | 'original'>('translated')
  const [subtitleSize, setSubtitleSize] = useState(1)
  const [showSizeMenu, setShowSizeMenu] = useState(false)

  const hasOriginal = (originalVttContent?.length ?? 0) > 0

  // Inject dynamic ::cue style for subtitle size
  useEffect(() => {
    const id = 'vp-cue-style'
    let el = document.getElementById(id) as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = id
      document.head.appendChild(el)
    }
    el.textContent = `video::cue { font-size: ${subtitleSize}em; background: rgba(0,0,0,0.8); color: #ffffff; }`
    return () => { /* keep style alive — updated on next render */ }
  }, [subtitleSize])

  // Sync track visibility with CC toggle and active track selection
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const sync = () => {
      const tracks = video.textTracks
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i]
        const isTranslated = t.label === 'Translated'
        const isOriginal = t.label === 'Original'
        if (!captionsOn) {
          t.mode = 'hidden'
        } else if (isTranslated && activeTrack === 'translated') {
          t.mode = 'showing'
        } else if (isOriginal && activeTrack === 'original') {
          t.mode = 'showing'
        } else {
          t.mode = 'hidden'
        }
      }
    }
    sync()
    const video2 = videoRef.current
    video2?.addEventListener('loadedmetadata', sync)
    return () => video2?.removeEventListener('loadedmetadata', sync)
  }, [captionsOn, activeTrack, translatedUrl, originalUrl])

  // Arrow key seek: ±10 seconds — capture phase so we intercept before the
  // native <video controls> handler, which otherwise seeks proportionally.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const video = videoRef.current
      if (!video) return
      if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); video.currentTime = Math.min(video.duration || 0, video.currentTime + 10) }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); e.stopPropagation(); video.currentTime = Math.max(0, video.currentTime - 10) }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="relative flex-1 min-h-0">
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          className="w-full h-full object-contain"
        >
          {translatedUrl && (
            <track key={`t-${translatedUrl}`} kind="subtitles" label="Translated" src={translatedUrl} default />
          )}
          {originalUrl && hasOriginal && (
            <track key={`o-${originalUrl}`} kind="subtitles" label="Original" src={originalUrl} />
          )}
        </video>
      </div>

      {/* Controls bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-black/90 border-t border-white/5 shrink-0">
        {/* CC toggle */}
        <button
          onClick={() => setCaptionsOn((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${captionsOn ? 'bg-primary/20 text-accent-green' : 'bg-white/5 text-white/40 hover:text-white/70'}`}
          title="Toggle captions"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          CC
        </button>

        {/* Track toggle */}
        {hasOriginal && (
          <div className="flex rounded overflow-hidden border border-white/10 text-xs">
            <button
              onClick={() => setActiveTrack('translated')}
              className={`px-2 py-1 transition-colors ${activeTrack === 'translated' ? 'bg-primary/20 text-accent-green' : 'text-white/40 hover:text-white/70'}`}
            >Translated</button>
            <button
              onClick={() => setActiveTrack('original')}
              className={`px-2 py-1 transition-colors ${activeTrack === 'original' ? 'bg-primary/20 text-accent-green' : 'text-white/40 hover:text-white/70'}`}
            >Original</button>
          </div>
        )}

        {/* Subtitle size */}
        <div className="relative">
          <button
            onClick={() => setShowSizeMenu((v) => !v)}
            className="px-2 py-1 rounded text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            title="Subtitle size"
          >Aa</button>
          {showSizeMenu && (
            <div className="absolute bottom-full mb-1 left-0 bg-base-card border border-white/10 rounded-lg p-2 flex items-center gap-2 shadow-xl">
              <button onClick={() => setSubtitleSize((s) => Math.max(0.6, parseFloat((s - 0.1).toFixed(1))))} className="text-white/50 hover:text-white px-1.5 text-sm">−</button>
              <span className="text-white/60 text-xs w-8 text-center">{subtitleSize.toFixed(1)}×</span>
              <button onClick={() => setSubtitleSize((s) => Math.min(2, parseFloat((s + 0.1).toFixed(1))))} className="text-white/50 hover:text-white px-1.5 text-sm">+</button>
            </div>
          )}
        </div>

        <div className="flex-1" />
        <span className="text-xs text-white/20">← → 10s</span>
      </div>
    </div>
  )
}
