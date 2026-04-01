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
    // handles HH:MM:SS.mmm or MM:SS.mmm
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
    // Skip header, blank lines, cue IDs (lines that aren't timecodes)
    if (!line.includes('-->')) { i++; continue }

    const tcMatch = line.match(/([\d:]+\.[\d]+)\s*-->\s*([\d:]+\.[\d]+)/)
    if (!tcMatch) { i++; continue }

    const startMs = toMs(tcMatch[1])
    const endMs = toMs(tcMatch[2])
    i++

    // Collect text lines until blank line
    const textLines: string[] = []
    while (i < lines.length && lines[i].trim() !== '') {
      // Strip VTT tags: <c>, </c>, inline timestamps like <00:00:01.234>
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

  // Deduplicate accumulating cues (same startMs, keep last)
  const deduped: VttCue[] = []
  for (let j = 0; j < cues.length; j++) {
    const next = cues[j + 1]
    if (next && next.startMs === cues[j].startMs) continue
    if (deduped.length > 0 && deduped[deduped.length - 1].text === cues[j].text) continue
    deduped.push(cues[j])
  }

  return deduped
}

export default function VideoPlayer({ videoUrl, vttContent }: VideoPlayerProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cues, setCues] = useState<VttCue[]>([])
  const [currentCue, setCurrentCue] = useState<VttCue | null>(null)
  const [captionsOn, setCaptionsOn] = useState(true)
  const [stickyMode, setStickyMode] = useState(false)

  // Parse VTT cues when content changes
  useEffect(() => {
    if (!vttContent) return
    setCues(parseVttCues(vttContent))
  }, [vttContent])

  // Track current subtitle based on video time
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (!video || cues.length === 0) return
    const ms = video.currentTime * 1000

    if (stickyMode) {
      // Sticky: show the last cue that has started (ignore end time)
      let active: VttCue | null = null
      for (const cue of cues) {
        if (cue.startMs <= ms) active = cue
        else break
      }
      setCurrentCue(active)
    } else {
      // Normal: show cue only within its time range
      const active = cues.find((c) => ms >= c.startMs && ms <= c.endMs) ?? null
      setCurrentCue(active)
    }
  }, [cues, stickyMode])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.addEventListener('timeupdate', handleTimeUpdate)
    return () => video.removeEventListener('timeupdate', handleTimeUpdate)
  }, [handleTimeUpdate])

  // Arrow key seeks: ±10 seconds (like YouTube)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const video = videoRef.current
      if (!video) return
      // Only if video area is focused or no input is focused
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 10)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        video.currentTime = Math.max(0, video.currentTime - 10)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Video + subtitle overlay */}
      <div className="relative flex-1 min-h-0">
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          className="w-full h-full object-contain"
        />

        {/* Custom subtitle overlay */}
        {captionsOn && currentCue && (
          <div
            className="absolute bottom-14 left-0 right-0 flex justify-center px-4 pointer-events-none"
          >
            <div className="bg-black/75 text-white text-sm font-medium px-4 py-2 rounded-lg text-center max-w-2xl leading-relaxed">
              {currentCue.text}
            </div>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-black/80 border-t border-white/5 shrink-0">
        {/* Captions toggle */}
        <button
          onClick={() => setCaptionsOn((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            captionsOn
              ? 'bg-primary/20 text-accent-green'
              : 'bg-white/5 text-white/40 hover:text-white/70'
          }`}
          title="Toggle captions (C)"
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
            stickyMode
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-white/5 text-white/40 hover:text-white/70'
          }`}
          title="Sticky captions: caption stays visible until the next one appears (useful when YouTube timing is off)"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          Sticky
        </button>

        <div className="flex-1" />

        <span className="text-xs text-white/25">← → skip 10s</span>
      </div>
    </div>
  )
}
