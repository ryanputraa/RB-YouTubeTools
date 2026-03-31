import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { app } from 'electron'
import type { JobResult } from '@shared/types'

export interface HistoryEntry {
  id: string
  date: string          // ISO timestamp
  videoTitle: string
  videoId: string
  thumbnailUrl: string
  targetLang: string
  blockCount: number
  srtPath: string
  vttPath: string
  videoPath?: string
  outputDir: string
}

const MAX_HISTORY = 50

function historyPath(): string {
  return join(app.getPath('userData'), 'history.json')
}

export function loadHistory(): HistoryEntry[] {
  const p = historyPath()
  if (!existsSync(p)) return []
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as HistoryEntry[]
  } catch {
    return []
  }
}

export function saveHistoryEntry(entry: HistoryEntry): void {
  const entries = loadHistory()
  // Remove duplicate by id if re-running
  const filtered = entries.filter((e) => e.id !== entry.id)
  filtered.unshift(entry)
  writeFileSync(historyPath(), JSON.stringify(filtered.slice(0, MAX_HISTORY), null, 2), 'utf-8')
}

export function deleteHistoryEntry(id: string): void {
  const entries = loadHistory().filter((e) => e.id !== id)
  writeFileSync(historyPath(), JSON.stringify(entries, null, 2), 'utf-8')
}

export function clearHistory(): void {
  writeFileSync(historyPath(), '[]', 'utf-8')
}
