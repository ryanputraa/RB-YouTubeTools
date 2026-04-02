import type { SubtitleBlock } from '@shared/types'

const BATCH_SIZE = 50
const CONCURRENT_BATCHES = 6
const DELAY_MS = 0
const MAX_RETRIES = 3

type TranslateProgressCallback = (pct: number, done: number, total: number) => void

/**
 * Translate an array of SubtitleBlocks to the target language.
 * Uses google-translate-api-x array mode — no separator hacks that get
 * mangled when the source language is non-Latin (e.g. Korean).
 */
export async function translateBlocks(
  blocks: SubtitleBlock[],
  targetLang: string,
  onProgress?: TranslateProgressCallback
): Promise<SubtitleBlock[]> {
  const translate = (await import('google-translate-api-x')).default

  const translated: SubtitleBlock[] = [...blocks]
  let done = 0

  // Split into batches, then process CONCURRENT_BATCHES at a time
  const batches: { start: number; texts: string[] }[] = []
  for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
    batches.push({ start: i, texts: blocks.slice(i, i + BATCH_SIZE).map((b) => b.text) })
  }

  for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
    const chunk = batches.slice(i, i + CONCURRENT_BATCHES)

    const results = await Promise.all(
      chunk.map((b) => translateBatch(translate, b.texts, targetLang))
    )

    for (let c = 0; c < chunk.length; c++) {
      const { start, texts } = chunk[c]
      const translatedTexts = results[c]
      for (let j = 0; j < texts.length; j++) {
        translated[start + j] = { ...blocks[start + j], text: translatedTexts[j] ?? blocks[start + j].text }
      }
      done += texts.length
    }

    onProgress?.(Math.round((done / blocks.length) * 100), done, blocks.length)
  }

  return translated
}

async function translateBatch(
  translate: Function,
  texts: string[],
  targetLang: string,
  retryCount = 0
): Promise<string[]> {
  try {
    // Pass array directly — the library returns an array of results in the same order.
    // This avoids the separator join/split approach which breaks on Korean/CJK input
    // because Google Translate alters the separator text.
    const results = await translate(texts, { to: targetLang, rejectOnPartialFail: false })
    const out = Array.isArray(results) ? results : [results]
    // null means that specific item failed — fall back to original text via caller
    return out.map((r: any) => (r?.text ?? '').trim())
  } catch (e: any) {
    const isRetryable =
      e?.message?.includes('429') ||
      e?.message?.includes('Too Many Requests') ||
      e?.message?.includes('Partial Translation')

    if (isRetryable && retryCount < MAX_RETRIES) {
      const delay = DELAY_MS * Math.pow(2, retryCount + 1)
      await sleep(delay)
      return translateBatch(translate, texts, targetLang, retryCount + 1)
    }

    console.error(`Translation batch failed: ${e.message}`)
    return texts
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
