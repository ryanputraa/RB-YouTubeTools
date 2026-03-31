import React, { useMemo } from 'react'

interface SubtitleViewerProps {
  vttContent: string
  srtPath: string
}

interface SubEntry {
  id: number
  start: string
  end: string
  text: string
}

function parseVtt(vtt: string): SubEntry[] {
  if (!vtt) return []
  const lines = vtt.replace(/\r\n/g, '\n').split('\n')
  const entries: SubEntry[] = []
  let i = 0

  // Skip WEBVTT header
  while (i < lines.length && !lines[i].includes('-->')) i++

  let id = 1
  while (i < lines.length) {
    const line = lines[i].trim()

    // Timecode line
    const tcMatch = line.match(
      /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/
    )
    if (tcMatch) {
      const start = tcMatch[1]
      const end = tcMatch[2]
      const textLines: string[] = []
      i++
      while (i < lines.length && lines[i].trim() !== '') {
        // Skip numeric-only lines (VTT cue IDs)
        if (!/^\d+$/.test(lines[i].trim())) {
          textLines.push(lines[i].trim())
        }
        i++
      }
      if (textLines.length > 0) {
        entries.push({ id: id++, start, end, text: textLines.join(' ') })
      }
    } else {
      i++
    }
  }

  return entries
}

function formatTime(tc: string): string {
  // Convert HH:MM:SS.mmm to M:SS or H:MM:SS
  const parts = tc.split(':')
  const h = parseInt(parts[0])
  const m = parseInt(parts[1])
  const s = parseFloat(parts[2])
  const sInt = Math.floor(s)

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sInt).padStart(2, '0')}`
  }
  return `${m}:${String(sInt).padStart(2, '0')}`
}

export default function SubtitleViewer({ vttContent, srtPath }: SubtitleViewerProps): JSX.Element {
  const entries = useMemo(() => parseVtt(vttContent), [vttContent])

  if (!vttContent) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Loading captions...</p>
        </div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-white/30 text-sm">No subtitle entries found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats bar */}
      <div className="px-5 py-2.5 border-b border-white/5 flex items-center justify-between shrink-0">
        <p className="text-white/40 text-xs">{entries.length} subtitle entries</p>
        <p className="text-white/30 text-xs font-mono truncate max-w-xs">{srtPath.split(/[\\/]/).pop()}</p>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex gap-3 group hover:bg-white/3 rounded-lg px-2 py-1.5 transition-colors"
          >
            <span className="text-accent-green text-xs font-mono shrink-0 mt-0.5 w-12 text-right opacity-60">
              {formatTime(entry.start)}
            </span>
            <p className="text-white/80 text-sm leading-relaxed flex-1">{entry.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
