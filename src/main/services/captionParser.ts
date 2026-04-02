import type { SubtitleBlock } from '@shared/types'

/**
 * Parse raw SRT string into structured SubtitleBlock array.
 */
export function parseSrt(raw: string): SubtitleBlock[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rawBlocks = normalized.trim().split(/\n{2,}/)
  const blocks: SubtitleBlock[] = []

  for (const rawBlock of rawBlocks) {
    const lines = rawBlock.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length < 3) continue

    const index = parseInt(lines[0], 10)
    if (isNaN(index)) continue

    const timeParts = lines[1].match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    )
    if (!timeParts) continue

    const rawText = lines.slice(2).join(' ')
    const text = cleanText(rawText)
    if (!text) continue

    blocks.push({ index, startTime: timeParts[1], endTime: timeParts[2], text })
  }

  return blocks
}

/**
 * Strip HTML tags, inline timestamps, >> speaker markers, and HTML entities.
 */
function cleanText(text: string): string {
  return text
    // Remove inline VTT timestamps like <00:00:01.234>
    .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '')
    // Remove all HTML/XML tags
    .replace(/<[^>]+>/g, '')
    // Strip >> speaker-change markers (YouTube uses these for multi-speaker content)
    .replace(/\s*>>+\s*/g, ' ')
    // Decode HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse whitespace
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Parse YouTube VTT into SubtitleBlock array.
 *
 * YouTube auto-captions use a rolling-window carry-forward pattern:
 * each cue starts with the complete text of the previous cue, then
 * adds new words. Example for a Korean video:
 *
 *   cue A [0:01→0:04]: "안녕하세요"
 *   cue B [0:04→0:08]: "안녕하세요 여러분 오늘은"   ← starts with cue A's text
 *   cue C [0:08→0:12]: "안녕하세요 여러분 오늘은 감사합니다"  ← starts with cue B's text
 *
 * Without collapsing this produces repeated/overlapping translated subtitles.
 * The fix: when cue[i]'s text is a prefix of cue[i+1]'s text, skip cue[i]
 * and carry its start time forward so the final cue in the chain gets the
 * correct (earliest) display start time.
 */
export function parseVtt(raw: string): SubtitleBlock[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const headerEnd = normalized.indexOf('\n\n')
  const body = headerEnd >= 0 ? normalized.slice(headerEnd + 2) : normalized

  const rawBlocks = body.trim().split(/\n{2,}/)
  const blocks: SubtitleBlock[] = []

  const toSrtTime = (t: string): string => {
    const parts = t.split(':')
    while (parts.length < 3) parts.unshift('0')
    const [h, m, s] = parts
    const [sec, ms] = s.split('.')
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${sec.padStart(2, '0')},${(ms || '000').padStart(3, '0').slice(0, 3)}`
  }

  const parseMs = (t: string): number => {
    const [h, rest] = t.split(',')
    const [hh, mm, ss] = h.split(':').map(Number)
    return hh * 3600000 + mm * 60000 + ss * 1000 + Number(rest)
  }

  for (const rawBlock of rawBlocks) {
    const lines = rawBlock.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length < 2) continue

    // Timecode line may be preceded by a cue ID
    let tcLine = lines[0]
    let textStart = 1
    if (!tcLine.includes('-->')) {
      tcLine = lines[1]
      textStart = 2
    }
    if (!tcLine.includes('-->')) continue

    const tcMatch = tcLine.match(/([\d:]+\.\d+)\s*-->\s*([\d:]+\.\d+)/)
    if (!tcMatch) continue

    const startTime = toSrtTime(tcMatch[1])
    const endTime = toSrtTime(tcMatch[2])

    // Skip carry-forward cues (< 100ms — these are the ~40ms transition duplicates)
    if (parseMs(endTime) - parseMs(startTime) < 100) continue

    const rawText = lines.slice(textStart).join(' ')
    const text = cleanText(rawText)
    if (!text) continue

    blocks.push({ index: blocks.length + 1, startTime, endTime, text })
  }

  // ── Rolling window collapse ───────────────────────────────────────────────
  // When block[i].text is a prefix of block[i+1].text, block[i] is an
  // intermediate rolling-window state. Skip it and carry its startTime forward
  // so the final (most complete) cue in the chain gets the correct start time.
  //
  // Minimum text length guard (>= 4 chars) prevents short accidental prefix
  // matches (e.g. "I" matching the start of "In the beginning").

  const collapsed: SubtitleBlock[] = []
  let pendingStart: string | null = null

  for (let i = 0; i < blocks.length; i++) {
    const cur = blocks[i]
    const next = blocks[i + 1]
    const effectiveStart = pendingStart ?? cur.startTime

    if (
      next &&
      cur.text.length >= 4 &&
      next.text.startsWith(cur.text)
    ) {
      // This cue's text is carried forward into the next — skip it
      pendingStart = effectiveStart
      continue
    }

    // Skip exact duplicate of the previous kept block
    const prev = collapsed[collapsed.length - 1]
    if (prev && prev.text === cur.text) {
      pendingStart = null
      continue
    }

    collapsed.push({ ...cur, startTime: effectiveStart, index: collapsed.length + 1 })
    pendingStart = null
  }

  return collapsed
}

/**
 * Detect format and parse either SRT or VTT.
 */
export function parseSubtitleFile(raw: string): SubtitleBlock[] {
  return raw.trim().startsWith('WEBVTT') ? parseVtt(raw) : parseSrt(raw)
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
 * Convert SRT timecodes (comma) to VTT (dot) and add WEBVTT header.
 */
export function srtToVtt(srt: string): string {
  return `WEBVTT\n\n${srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`
}
