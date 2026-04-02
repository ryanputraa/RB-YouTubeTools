import React, { useRef, useEffect, useState, useCallback } from 'react'

interface VttCue {
  startMs: number
  endMs: number
  text: string
}

interface VideoPlayerProps {
  videoUrl: string
  vttContent: string
}

function parseVttCues(vtt: string): VttCue[] {
  const cues: VttCue[] = []
  const lines = vtt.replace(/\r\n/g, '\n').split('\n')
  let i = 0

  const toMs = (t: string): number => {
    const parts = t.split(':')
    while (parts.length < 3) parts.unshift('0')
    const [h, m, s] = parts
    const [sec, ms] = s.split('.')
    return (
      parseInt(h) * 3600000 +
      parseInt(m) * 60000 +
      parseInt(sec) * 1000 +
      parseInt((ms || '000').padEnd(3, '0').slice(0, 3))
    )
  }

  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line.includes('-->')) { i++; continue }

    const tcMatch = line.match(/([\d:]+\.[\d]+)\s*-->\s*([\d:]+\.[\d]+)/)
    if (!tcMatch) { i++; continue }

    const startMs = toMs(tcMatch[1])
    const endMs = toMs(tcMatch[2])
    i++

    const textLines: string[] = []
    while (i < lines.length && lines[i].trim() !== '') {
      const cleaned = lines[i]
        .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '')
        .replace(/<[^>]+>/g, '')
        .trim()
      if (cleaned) textLines.push(cleaned)
      i++
    }

    const text = textLines.join(' ').trim()
    if (text && endMs - startMs >= 100) {
      cues.push({ startMs, endMs, text })
    }
  }

  return cues
}

export default function VideoPlayer({ videoUrl, vttContent }: VideoPlayerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cues, setCues] = useState<VttCue[]>([])
  const [currentCue, setCurrentCue] = useState<VttCue | null>(null)
  const [captionsOn, setCaptionsOn] = useState(true)
  const [stickyMode, setStickyMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const stickyRef = useRef(stickyMode)

  useEffect(() => { stickyRef.current = stickyMode }, [stickyMode])

  useEffect(() => {
    if (!vttContent) return
    setCues(parseVttCues(vttContent))
  }, [vttContent])

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (!video || cues.length === 0) return
    const ms = video.currentTime * 1000

    if (stickyRef.current) {
      let active: VttCue | null = null
      for (const cue of cues) {
        if (cue.startMs <= ms) active = cue
        else break
      }
      setCurrentCue(active)
    } else {
      setCurrentCue(cues.find((c) => ms >= c.startMs && ms <= c.endMs) ?? null)
    }
  }, [cues])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.addEventListener('timeupdate', handleTimeUpdate)
    return () => video.removeEventListener('timeupdate', handleTimeUpdate)
  }, [handleTimeUpdate])

  // Arrow key seek: ±10 seconds, like YouTube
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const video = videoRef.current
      if (!video) return
      if (e.key === 'ArrowRight') { e.preventDefault(); video.currentTime = Math.min(video.duration || 0, video.currentTime + 10) }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 10) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Fullscreen: intercept native video fullscreen and redirect to the container
  // div so our subtitle overlay is included in fullscreen mode.
  useEffect(() => {
    const video = videoRef.current
    const container = containerRef.current
    if (!video || !container) return

    let switching = false

    const onFullscreenChange = async () => {
      setIsFullscreen(!!document.fullscreenElement)
      if (switching) return
      if (document.fullscreenElement === video) {
        // Video went fullscreen — swap to container so overlay is visible
        switching = true
        try {
          await document.exitFullscreen()
          await container.requestFullscreen()
        } catch {}
        switching = false
      }
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-black">
      {/* Video + subtitle overlay */}
      <div className="relative flex-1 min-h-0">
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          className="w-full h-full object-contain"
        />

        {/* Subtitle overlay — positioned over video, included in fullscreen */}
        {captionsOn && currentCue && (
          <div className="absolute bottom-14 left-0 right-0 flex justify-center px-4 pointer-events-none">
            <div className="bg-black/80 text-white text-sm font-medium px-4 py-2 rounded-lg text-center max-w-2xl leading-relaxed shadow-lg">
              {currentCue.text}
            </div>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-black/90 border-t border-white/5 shrink-0">
        {/* CC toggle */}
        <button
          onClick={() => setCaptionsOn((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            captionsOn ? 'bg-primary/20 text-accent-green' : 'bg-white/5 text-white/40 hover:text-white/70'
          }`}
          title="Toggle captions"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          CC
        </button>

        {/* Sticky captions toggle */}
        <button
          onClick={() => setStickyMode((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            stickyMode ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-white/40 hover:text-white/70'
          }`}
          title="Sticky captions: subtitle stays until the next one appears"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          Sticky
        </button>

        <div className="flex-1" />

        <span className="text-xs text-white/20">← → 10s</span>

        {/* Fullscreen button */}
        <button
          onClick={toggleFullscreen}
          className="text-white/40 hover:text-white transition-colors"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
