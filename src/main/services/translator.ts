import type { SubtitleBlock } from '@shared/types'

const BATCH_SIZE = 20
const SEPARATOR = '\n|||SPLIT|||\n'
const DELAY_MS = 300
const MAX_RETRIES = 3

type TranslateProgressCallback = (pct: number, done: number, total: number) => void

/**
 * Translate an array of SubtitleBlocks to the target language.
 * Uses google-translate-api-x in batches with exponential backoff.
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
        text: translatedTexts[j] ?? batchBlocks[j].text // fallback to original
      }
    }

    done += batchBlocks.length
    const pct = Math.round((done / blocks.length) * 100)
    onProgress?.(pct, done, blocks.length)

    // Rate limit protection between batches
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
  const joined = texts.join(SEPARATOR)

  try {
    const result = await translate(joined, { to: targetLang })
    const translatedText: string = result.text || joined

    const parts = translatedText.split(SEPARATOR)

    // Validate split count matches input
    if (parts.length === texts.length) {
      return parts.map((p) => p.trim())
    }

    // Split count mismatch — fall back to individual translation
    console.warn(
      `Batch split mismatch (expected ${texts.length}, got ${parts.length}). Falling back to individual translation.`
    )
    return translateIndividual(translate, texts, targetLang)
  } catch (e: any) {
    // Handle rate limiting with exponential backoff
    const isRateLimit =
      e?.message?.includes('429') || e?.message?.includes('Too Many Requests')

    if (isRateLimit && retryCount < MAX_RETRIES) {
      const delay = DELAY_MS * Math.pow(2, retryCount + 1)
      console.warn(`Rate limited. Retrying batch in ${delay}ms (attempt ${retryCount + 1})`)
      await sleep(delay)
      return translateBatch(translate, texts, targetLang, retryCount + 1)
    }

    // Non-recoverable error — return originals
    console.error(`Translation batch failed: ${e.message}`)
    return texts
  }
}

async function translateIndividual(
  translate: Function,
  texts: string[],
  targetLang: string
): Promise<string[]> {
  const results: string[] = []
  for (const text of texts) {
    try {
      const result = await translate(text, { to: targetLang })
      results.push(result.text || text)
      await sleep(100)
    } catch {
      results.push(text) // fallback to original
    }
  }
  return results
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
