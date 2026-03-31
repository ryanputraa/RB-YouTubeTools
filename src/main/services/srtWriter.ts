import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import type { SubtitleBlock } from '@shared/types'
import { assembleSrt, srtToVtt } from './captionParser'

/**
 * Sanitize a string for use as a filename.
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80)
    .trim() || 'translated'
}

/**
 * Write translated SubtitleBlock array as both .srt and .vtt files.
 * Returns absolute paths to both files.
 */
export async function writeSrtAndVtt(
  blocks: SubtitleBlock[],
  outputDir: string,
  videoTitle: string,
  targetLang: string
): Promise<{ srtPath: string; vttPath: string }> {
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true })
  }

  const base = `${sanitizeFilename(videoTitle)}_${targetLang}`
  const srtPath = join(outputDir, `${base}.srt`)
  const vttPath = join(outputDir, `${base}.vtt`)

  const srtContent = assembleSrt(blocks)
  const vttContent = srtToVtt(srtContent)

  await writeFile(srtPath, srtContent, 'utf-8')
  await writeFile(vttPath, vttContent, 'utf-8')

  return { srtPath, vttPath }
}
