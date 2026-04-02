import React, { useRef, useEffect, useState } from 'react'

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: (() => void) | undefined
  }
}

interface VttCue { startMs: number; endMs: number; text: string }

function parseVttCues(vtt: string): VttCue[] {
  const cues: VttCue[] = []
  const lines = vtt.replace(/\r\n/g, '\n').split('\n')
  let i = 0
  const toMs = (t: string) => {
    const parts = t.split(':')
    while (parts.length < 3) parts.unshift('0')
    const [h, m, s] = parts; const [sec, ms] = s.split('.')
    return parseInt(h)*3600000 + parseInt(m)*60000 + parseInt(sec)*1000 + parseInt((ms||'000').padEnd(3,'0').slice(0,3))
  }
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line.includes('-->')) { i++; continue }
    const m = line.match(/([\d:]+\.[\d]+)\s*-->\s*([\d:]+\.[\d]+)/)
    if (!m) { i++; continue }
    const startMs = toMs(m[1]); const endMs = toMs(m[2]); i++
    const textLines: string[] = []
    while (i < lines.length && lines[i].trim() !== '') {
      const cleaned = lines[i].replace(/<[^>]+>/g, '').trim()
      if (cleaned) textLines.push(cleaned)
      i++
    }
    const text = textLines.join(' ').trim()
    if (text && endMs - startMs >= 100) cues.push({ startMs, endMs, text })
  }
  return cues
}

function useCues(vttContent: string) {
  const [cues, setCues] = useState<VttCue[]>([])
  useEffect(() => { setCues(vttContent ? parseVttCues(vttContent) : []) }, [vttContent])
  return cues
}

interface YouTubePlayerProps {
  videoId: string
  vttContent: string
  originalVttContent?: string
  outputDir: string
  onVideoDownloaded: (videoPath: string) => void
}

export default function YouTubePlayer({ videoId, vttContent, originalVttContent, outputDir, onVideoDownloaded }: YouTubePlayerProps): JSX.Element {
  const playerRef = useRef<any>(null)
  const playerDivId = useRef(`yt-${videoId}-${Date.now()}`)

  const [activeTrack, setActiveTrack] = useState<'translated' | 'original'>('translated')
  const [captionsOn, setCaptionsOn] = useState(true)
  const [subtitleSize, setSubtitleSize] = useState(1)       // em multiplier
  const [showSizeMenu, setShowSizeMenu] = useState(false)

  const translatedCues = useCues(vttContent)
  const originalCues = useCues(originalVttContent ?? '')
  const activeCues = activeTrack === 'original' && originalCues.length > 0 ? originalCues : translatedCues
  const [currentCue, setCurrentCue] = useState<VttCue | null>(null)

  const [downloading, setDownloading] = useState(false)
  const [downloadPct, setDownloadPct] = useState(-1)
  const [downloadMsg, setDownloadMsg] = useState('')
  const [downloadedPath, setDownloadedPath] = useState<string | null>(null)

  // Subtitle polling
  useEffect(() => {
    if (activeCues.length === 0) return
    const interval = setInterval(() => {
      const player = playerRef.current
      if (!player?.getCurrentTime) return
      const ms = player.getCurrentTime() * 1000
      setCurrentCue(activeCues.find((c) => ms >= c.startMs && ms <= c.endMs) ?? null)
    }, 200)
    return () => clearInterval(interval)
  }, [activeCues])

  // Init YouTube IFrame API
  useEffect(() => {
    const initPlayer = () => {
      if (!window.YT?.Player) return
      playerRef.current = new window.YT.Player(playerDivId.current, {
        height: '100%', width: '100%', videoId,
        playerVars: { cc_load_policy: 0, rel: 0, modestbranding: 1, autoplay: 0 },
      })
    }
    if (window.YT?.Player) { initPlayer() }
    else {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => { prev?.(); initPlayer() }
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(s)
      }
    }
    return () => { playerRef.current?.destroy?.(); playerRef.current = null }
  }, [videoId])

  // Arrow key seek
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const player = playerRef.current
      if (!player?.getCurrentTime) return
      if (e.key === 'ArrowRight') { e.preventDefault(); player.seekTo(player.getCurrentTime() + 10, true) }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); player.seekTo(Math.max(0, player.getCurrentTime() - 10), true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleDownload = async () => {
    setDownloading(true)
    setDownloadPct(-1)
    setDownloadMsg('Fetching video info...')
    const url = `https://www.youtube.com/watch?v=${videoId}`
    const res = await window.electronAPI.downloadVideoNow(url, outputDir, (pct, msg) => {
      setDownloadPct(pct)
      setDownloadMsg(pct >= 0 ? `${pct.toFixed(0)}%` : msg.length > 60 ? msg.slice(0, 60) + '…' : msg)
    })
    setDownloading(false)
    if ('error' in res) {
      setDownloadMsg(`Error: ${res.message}`)
    } else {
      setDownloadedPath(res.videoPath)
    }
  }

  const hasOriginal = (originalVttContent?.length ?? 0) > 0

  return (
    <div className="flex flex-col h-full bg-black">
      {/* YouTube iframe */}
      <div className="flex-1 min-h-0">
        <div id={playerDivId.current} className="w-full h-full" />
      </div>

      {/* Progress bar — shown during download */}
      {downloading && (
        <div className="h-1 bg-white/10">
          <div
            className="h-1 bg-primary transition-all duration-300"
            style={{ width: downloadPct >= 0 ? `${downloadPct}%` : '5%' }}
          />
        </div>
      )}

      {/* Download complete notification */}
      {downloadedPath && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-primary/10 border-t border-primary/20 shrink-0">
          <p className="text-accent-green text-sm font-medium">Download complete — switch to local player?</p>
          <div className="flex gap-2">
            <button onClick={() => onVideoDownloaded(downloadedPath)} className="btn-primary text-xs py-1.5 px-3">Switch now</button>
            <button onClick={() => setDownloadedPath(null)} className="text-white/40 hover:text-white text-xs px-2 transition-colors">Dismiss</button>
          </div>
        </div>
      )}

      {/* Subtitle bar — sits below iframe, no z-index fight */}
      <div className={`px-4 py-2 bg-black text-center min-h-[2.5rem] flex items-center justify-center ${!captionsOn || !currentCue ? 'opacity-0' : ''}`}>
        <span className="bg-black/90 text-white font-medium px-4 py-1.5 rounded-lg leading-relaxed" style={{ fontSize: `${subtitleSize}em` }}>
          {currentCue?.text ?? ''}
        </span>
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
            <button onClick={() => setActiveTrack('translated')} className={`px-2 py-1 transition-colors ${activeTrack === 'translated' ? 'bg-primary/20 text-accent-green' : 'text-white/40 hover:text-white/70'}`}>Translated</button>
            <button onClick={() => setActiveTrack('original')} className={`px-2 py-1 transition-colors ${activeTrack === 'original' ? 'bg-primary/20 text-accent-green' : 'text-white/40 hover:text-white/70'}`}>Original</button>
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
              <button onClick={() => setSubtitleSize((s) => Math.max(0.6, s - 0.1))} className="text-white/50 hover:text-white px-1.5 text-sm">−</button>
              <span className="text-white/60 text-xs w-8 text-center">{subtitleSize.toFixed(1)}×</span>
              <button onClick={() => setSubtitleSize((s) => Math.min(2, s + 0.1))} className="text-white/50 hover:text-white px-1.5 text-sm">+</button>
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Download progress text */}
        {downloading && (
          <span className="text-xs text-white/40 truncate max-w-[160px]">{downloadMsg}</span>
        )}

        {/* Download button */}
        {!downloading && !downloadedPath && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            title="Download video for smooth local playback"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Want a better experience? Download instead
          </button>
        )}

        <span className="text-xs text-white/20 shrink-0">← → 10s</span>
      </div>
    </div>
  )
}
