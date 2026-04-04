import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AppSettings } from '@shared/types'

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function defaults(): AppSettings {
  return {
    outputDir: join(app.getPath('videos'), 'RB-YouTube-Tools'),
    videoQuality: 'best',
    wipeOnUninstall: false
  }
}

export function loadSettings(): AppSettings {
  try {
    const p = settingsPath()
    if (!existsSync(p)) return defaults()
    return { ...defaults(), ...JSON.parse(readFileSync(p, 'utf-8')) }
  } catch {
    return defaults()
  }
}

export function saveSettings(settings: AppSettings): void {
  writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
}
