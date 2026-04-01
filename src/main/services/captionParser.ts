import type { SubtitleBlock } from '@shared/types'

/**
 * Parse raw SRT string into structured SubtitleBlock array.
 * Handles YouTube's auto-caption quirks:
 * - <c> span tags for word-by-word highlighting
 * - Inline timestamps like <00:00:01.234>
 * - HTML entities
 * - Blank/whitespace-only text blocks
 */
export function parseSrt(raw: string): SubtitleBlock[] {
  // Normalize line endings
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Split into blocks by one or more blank lines
  const rawBlocks = normalized.trim().split(/\n{2,}/)

  const blocks: SubtitleBlock[] = []

  for (const rawBlock of rawBlocks) {
    const lines = rawBlock.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length < 3) continue

    // First line: numeric index
    const index = parseInt(lines[0], 10)
    if (isNaN(index)) continue

    // Second line: timecode "HH:MM:SS,mmm --> HH:MM:SS,mmm"
    const timeParts = lines[1].match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    )
    if (!timeParts) continue

    const startTime = timeParts[1]
    const endTime = timeParts[2]

    // Remaining lines: text content
    const rawText = lines.slice(2).join(' ')
    const text = cleanSrtText(rawText)

    if (!text) continue

    blocks.push({ index, startTime, endTime, text })
  }

  return blocks
}

/**
 * Strip HTML/XML tags, inline timestamps, and decode HTML entities.
 */
function cleanSrtText(text: string): string {
  return text
    // Remove inline timestamps like <00:00:01.234>
    .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '')
    // Remove all remaining HTML tags (<c>, </c>, <b>, etc.)
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Parse YouTube VTT into SubtitleBlock array.
 * YouTube VTT has word-by-word inline timestamps and duplicate carry-forward
 * cues (0.01s transitions). We skip short cues and deduplicate.
 */
export function parseVtt(raw: string): SubtitleBlock[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Drop the header (everything before first blank line)
  const headerEnd = normalized.indexOf('\n\n')
  const body = headerEnd >= 0 ? normalized.slice(headerEnd + 2) : normalized

  const rawBlocks = body.trim().split(/\n{2,}/)
  const blocks: SubtitleBlock[] = []
  let index = 1

  for (const rawBlock of rawBlocks) {
    const lines = rawBlock.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length < 2) continue

    // Find timecode line (may be preceded by a cue id)
    let tcLine = lines[0]
    let textStart = 1
    if (!tcLine.includes('-->')) {
      tcLine = lines[1]
      textStart = 2
    }
    if (!tcLine.includes('-->')) continue

    // Parse VTT timecodes: HH:MM:SS.mmm or MM:SS.mmm
    const tcMatch = tcLine.match(
      /([\d:]+\.\d+)\s*-->\s*([\d:]+\.\d+)/
    )
    if (!tcMatch) continue

    const toSrtTime = (t: string): string => {
      const parts = t.split(':')
      while (parts.length < 3) parts.unshift('0')
      const [h, m, s] = parts
      const [sec, ms] = s.split('.')
      return `${h.padStart(2,'0')}:${m.padStart(2,'0')}:${sec.padStart(2,'0')},${(ms || '000').padStart(3,'0').slice(0, 3)}`
    }

    const startTime = toSrtTime(tcMatch[1])
    const endTime = toSrtTime(tcMatch[2])

    // Calculate duration in ms to skip carry-forward cues (< 100ms)
    const parseMs = (t: string) => {
      const [h, rest] = t.split(',')
      const [hh, mm, ss] = h.split(':').map(Number)
      return hh * 3600000 + mm * 60000 + ss * 1000 + Number(rest)
    }
    if (parseMs(endTime) - parseMs(startTime) < 100) continue

    const rawText = lines.slice(textStart).join(' ')
    const text = cleanSrtText(rawText)
    if (!text) continue

    blocks.push({ index: index++, startTime, endTime, text })
  }

  // Post-process: YouTube auto-captions use an accumulating pattern where
  // multiple cues share the same start time, each adding one more word.
  // e.g. "안녕" → "안녕 하세요" → "안녕 하세요 여러분" all at 0:01.000
  // Keep only the last (most complete) cue per start time.
  const deduped: SubtitleBlock[] = []
  for (let i = 0; i < blocks.length; i++) {
    const cur = blocks[i]
    const next = blocks[i + 1]
    // Skip if same start time as next block (next is more complete)
    if (next && next.startTime === cur.startTime) continue
    // Skip exact duplicate of previous
    if (deduped.length > 0 && deduped[deduped.length - 1].text === cur.text) continue
    deduped.push({ ...cur, index: deduped.length + 1 })
  }

  return deduped
}

/**
 * Detect format and parse either SRT or VTT into SubtitleBlock array.
 */
export function parseSubtitleFile(raw: string): SubtitleBlock[] {
  const trimmed = raw.trim()
  if (trimmed.startsWith('WEBVTT')) return parseVtt(raw)
  return parseSrt(raw)
}

/**
 * Reassemble SubtitleBlock array back to SRT string.
 */
export function assembleSrt(blocks: SubtitleBlock[]): string {
  return blocks
    .map((b, i) => `${i + 1}\n${b.startTime} --> ${b.endTime}\n${b.text}`)
    .join('\n\n')
}

/**
 * Convert SRT string to WebVTT string.
 * - Replace comma with dot in timecodes
 * - Add WEBVTT header
 */
export function srtToVtt(srt: string): string {
  const vtt = srt
    // Convert SRT timecode comma to VTT dot
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')

  return `WEBVTT\n\n${vtt}`
}
