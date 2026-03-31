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
