import type { SubtitleBlock } from '@shared/types'

// ── Shared text cleaning ──────────────────────────────────────────────────────

function stripTags(text: string): string {
  return text
    .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '')  // inline VTT timestamps
    .replace(/<[^>]+>/g, '')                        // all other tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ── SRT parser ────────────────────────────────────────────────────────────────

export function parseSrt(raw: string): SubtitleBlock[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rawBlocks = normalized.trim().split(/\n{2,}/)
  const blocks: SubtitleBlock[] = []

  for (const rawBlock of rawBlocks) {
    const lines = rawBlock.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length < 3) continue
    const index = parseInt(lines[0], 10)
    if (isNaN(index)) continue
    const timeParts = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/)
    if (!timeParts) continue
    const text = stripTags(lines.slice(2).join(' '))
    if (!text) continue
    blocks.push({ index, startTime: timeParts[1], endTime: timeParts[2], text })
  }

  return blocks
}

// ── VTT helpers ───────────────────────────────────────────────────────────────

function toSrtTime(t: string): string {
  const parts = t.split(':')
  while (parts.length < 3) parts.unshift('0')
  const [h, m, s] = parts
  const [sec, ms] = s.split('.')
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${sec.padStart(2, '0')},${(ms || '000').padStart(3, '0').slice(0, 3)}`
}

function parseMs(srtTime: string): number {
  const [hms, ms] = srtTime.split(',')
  const [h, m, s] = hms.split(':').map(Number)
  return h * 3600000 + m * 60000 + s * 1000 + Number(ms)
}

// ── Auto-generated VTT parser ─────────────────────────────────────────────────
//
// YouTube auto-caption VTT format uses a 2-line rolling window per cue:
//
//   00:00:02.040 --> 00:00:04.910
//   인사를 하겠습니다. 둘 셋          ← line 1: carry-forward from previous cue (plain text)
//   &gt;&gt; 안녕하세요.<c> 아욱입니다.</c>  ← line 2: NEW words for this cue (with word tags)
//
// Between each real cue there's a 10ms transition cue with only line 1 (the
// carry-forward snapshot). We ignore those (< 100ms duration).
//
// Strategy:
//   1. Skip transition cues (< 100ms)
//   2. For real cues, take ONLY line 2 (the new words line)
//   3. Clean tags from line 2
//   4. Handle >> as a speaker-change marker: strip it, start fresh text
//
// >> appears as &gt;&gt; in the raw VTT (HTML-encoded). After HTML decoding it
// becomes >>. It appears at the START of line 2 when a new speaker begins.

function parseAutoVtt(raw: string): SubtitleBlock[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const headerEnd = normalized.indexOf('\n\n')
  const body = headerEnd >= 0 ? normalized.slice(headerEnd + 2) : normalized
  const rawBlocks = body.trim().split(/\n{2,}/)

  const blocks: SubtitleBlock[] = []

  for (const rawBlock of rawBlocks) {
    const lines = rawBlock.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length < 2) continue

    // Find timecode line
    let tcLine = lines[0]
    let textStart = 1
    if (!tcLine.includes('-->')) {
      if (lines.length < 3) continue
      tcLine = lines[1]
      textStart = 2
    }
    if (!tcLine.includes('-->')) continue

    const tcMatch = tcLine.match(/([\d:]+\.\d+)\s*-->\s*([\d:]+\.\d+)/)
    if (!tcMatch) continue

    const startTime = toSrtTime(tcMatch[1])
    const endTime = toSrtTime(tcMatch[2])
    const durationMs = parseMs(endTime) - parseMs(startTime)

    // Skip transition cues (the 10ms carry-forward snapshots between real cues)
    if (durationMs < 100) continue

    const textLines = lines.slice(textStart)

    // For the 2-line rolling window format:
    // - If there are 2+ text lines, take only the LAST line (new words)
    // - If there's only 1 text line, use it (beginning of video / single speaker)
    const newWordsLine = textLines.length >= 2 ? textLines[textLines.length - 1] : textLines[0]

    // Decode HTML entities first so >> is visible, then strip tags
    const decoded = stripTags(newWordsLine)

    // Strip leading >> speaker markers (keep the text after them)
    // >> marks a speaker change — the text following it is the actual speech
    const text = decoded.replace(/^>>\s*/, '').trim()

    if (!text) continue

    blocks.push({ index: blocks.length + 1, startTime, endTime, text })
  }

  // Deduplicate: skip if identical to previous block
  const deduped: SubtitleBlock[] = []
  for (const b of blocks) {
    if (deduped.length > 0 && deduped[deduped.length - 1].text === b.text) continue
    deduped.push({ ...b, index: deduped.length + 1 })
  }

  return deduped
}

// ── Manual VTT parser ─────────────────────────────────────────────────────────
//
// Manual captions are clean — no rolling window, no inline timestamps,
// no carry-forward. Just timecode + text lines. May use [bracket annotations]
// for scene descriptions which we keep as-is since they're part of the content.

function parseManualVtt(raw: string): SubtitleBlock[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const headerEnd = normalized.indexOf('\n\n')
  const body = headerEnd >= 0 ? normalized.slice(headerEnd + 2) : normalized
  const rawBlocks = body.trim().split(/\n{2,}/)

  const blocks: SubtitleBlock[] = []

  for (const rawBlock of rawBlocks) {
    const lines = rawBlock.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length < 2) continue

    let tcLine = lines[0]
    let textStart = 1
    if (!tcLine.includes('-->')) {
      if (lines.length < 3) continue
      tcLine = lines[1]
      textStart = 2
    }
    if (!tcLine.includes('-->')) continue

    const tcMatch = tcLine.match(/([\d:]+\.\d+)\s*-->\s*([\d:]+\.\d+)/)
    if (!tcMatch) continue

    const startTime = toSrtTime(tcMatch[1])
    const endTime = toSrtTime(tcMatch[2])

    const text = stripTags(lines.slice(textStart).join(' '))
    if (!text) continue

    blocks.push({ index: blocks.length + 1, startTime, endTime, text })
  }

  return blocks
}

// ── Format detection ──────────────────────────────────────────────────────────
//
// Auto-generated VTT is identified by the presence of inline word timestamps
// like <00:00:01.234> in the body, which manual captions never have.

function isAutoGeneratedVtt(raw: string): boolean {
  return /<\d{2}:\d{2}:\d{2}\.\d{3}>/.test(raw)
}

// ── Public API ────────────────────────────────────────────────────────────────

export function parseVtt(raw: string): SubtitleBlock[] {
  return isAutoGeneratedVtt(raw) ? parseAutoVtt(raw) : parseManualVtt(raw)
}

export function parseSubtitleFile(raw: string): SubtitleBlock[] {
  return raw.trim().startsWith('WEBVTT') ? parseVtt(raw) : parseSrt(raw)
}

export function assembleSrt(blocks: SubtitleBlock[]): string {
  return blocks
    .map((b, i) => `${i + 1}\n${b.startTime} --> ${b.endTime}\n${b.text}`)
    .join('\n\n')
}

export function srtToVtt(srt: string): string {
  return `WEBVTT\n\n${srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`
}
