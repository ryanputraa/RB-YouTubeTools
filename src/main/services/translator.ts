import type { SubtitleBlock } from '@shared/types'

const BATCH_SIZE = 20
const DELAY_MS = 300
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

  for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
    const batchBlocks = blocks.slice(i, i + BATCH_SIZE)
    const texts = batchBlocks.map((b) => b.text)

    const translatedTexts = await translateBatch(translate, texts, targetLang)

    for (let j = 0; j < batchBlocks.length; j++) {
      translated[i + j] = {
        ...batchBlocks[j],
        text: translatedTexts[j] ?? batchBlocks[j].text
      }
    }

    done += batchBlocks.length
    onProgress?.(Math.round((done / blocks.length) * 100), done, blocks.length)

    if (i + BATCH_SIZE < blocks.length) {
      await sleep(DELAY_MS)
    }
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
    const results = await translate(texts, { to: targetLang })
    const out = Array.isArray(results) ? results : [results]
    return out.map((r: any) => (r?.text ?? '').trim())
  } catch (e: any) {
    const isRateLimit =
      e?.message?.includes('429') || e?.message?.includes('Too Many Requests')

    if (isRateLimit && retryCount < MAX_RETRIES) {
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
