import { ipcMain, dialog, shell, BrowserWindow, app, session } from 'electron'
import { readFile as fsReadFile, writeFile, rm } from 'fs/promises'
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { getFileServerPort } from './services/fileServer'
import {
  resolveBinary,
  getVideoInfo,
  downloadCaptions,
  downloadVideo,
  getStreamUrl,
  downloadYtdlpBinary,
  resolveFfmpeg,
  downloadFfmpegBinary
} from './services/ytdlp'
import { parseSubtitleFile } from './services/captionParser'
import { translateBlocks } from './services/translator'
import { writeSrtAndVtt } from './services/srtWriter'
import { saveHistoryEntry, loadHistory, deleteHistoryEntry, clearHistory } from './services/history'
import { loadSettings, saveSettings } from './services/settings'
import type { JobOptions, JobProgressEvent, JobResult, YtdlpStatus, IpcError, AppSettings } from '@shared/types'

export function registerAllIpcHandlers(): void {
  // ── get-file-server-port ─────────────────────────────────────────────────────
  ipcMain.handle('get-file-server-port', () => getFileServerPort())

  // ── get-default-output-dir ───────────────────────────────────────────────────
  ipcMain.handle('get-default-output-dir', (): string => {
    const settings = loadSettings()
    const dir = settings.outputDir
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return dir
  })

  // ── check-ytdlp ──────────────────────────────────────────────────────────────
  ipcMain.handle('check-ytdlp', async (): Promise<YtdlpStatus> => {
    try {
      const { path, version } = await resolveBinary()
      return { found: true, path, version }
    } catch {
      return { found: false }
    }
  })

  // ── download-ytdlp ───────────────────────────────────────────────────────────
  ipcMain.handle('download-ytdlp', async (): Promise<{ success: boolean; path: string } | IpcError> => {
    try {
      const win = BrowserWindow.getAllWindows()[0]
      const binPath = await downloadYtdlpBinary((pct, msg) => {
        win?.webContents.send('ytdlp-download-progress', pct, msg)
      })
      return { success: true, path: binPath }
    } catch (e) {
      return { error: true, message: (e as Error).message }
    }
  })

  // ── check-ffmpeg ─────────────────────────────────────────────────────────────
  ipcMain.handle('check-ffmpeg', () => resolveFfmpeg())

  // ── download-ffmpeg ───────────────────────────────────────────────────────────
  ipcMain.handle('download-ffmpeg', async (): Promise<{ success: boolean; path: string } | IpcError> => {
    try {
      const win = BrowserWindow.getAllWindows()[0]
      const binPath = await downloadFfmpegBinary((pct, msg) => {
        win?.webContents.send('ffmpeg-download-progress', pct, msg)
      })
      return { success: true, path: binPath }
    } catch (e) {
      return { error: true, message: (e as Error).message }
    }
  })

  // ── get-video-info ───────────────────────────────────────────────────────────
  ipcMain.handle('get-video-info', async (_event, url: string) => {
    try {
      const info = await getVideoInfo(url)
      return info
    } catch (e) {
      return { error: true, message: (e as Error).message } as IpcError
    }
  })

  // ── start-job ────────────────────────────────────────────────────────────────
  ipcMain.handle('start-job', async (_event, options: JobOptions) => {
    const jobId = Date.now().toString()
    const win = BrowserWindow.getAllWindows()[0]

    const emit = (partial: Omit<JobProgressEvent, 'jobId'>) => {
      win?.webContents.send('job-progress', { ...partial, jobId })
    }

    // Run job asynchronously so we can return jobId immediately
    runJob(jobId, options, emit).catch(() => {})

    return { jobId }
  })

  // ── select-cookies-file ──────────────────────────────────────────────────────
  ipcMain.handle('select-cookies-file', async () => {
    const win = BrowserWindow.getAllWindows()[0]
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      title: 'Select cookies.txt file',
      filters: [{ name: 'Cookies file', extensions: ['txt'] }]
    })
    if (result.canceled || !result.filePaths[0]) return { cancelled: true }
    return { path: result.filePaths[0] }
  })

  // ── select-output-dir ────────────────────────────────────────────────────────
  ipcMain.handle('select-output-dir', async () => {
    const win = BrowserWindow.getAllWindows()[0]
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Output Folder'
    })
    if (result.canceled || !result.filePaths[0]) {
      return { cancelled: true }
    }
    return { path: result.filePaths[0] }
  })

  // ── open-folder ──────────────────────────────────────────────────────────────
  ipcMain.handle('open-folder', async (_event, folderPath: string) => {
    await shell.openPath(folderPath)
  })

  // ── read-file ────────────────────────────────────────────────────────────────
  ipcMain.handle('read-file', async (_event, filePath: string) => {
    try {
      if (!existsSync(filePath)) {
        return { error: true, message: `File not found: ${filePath}` } as IpcError
      }
      const content = await fsReadFile(filePath, 'utf-8')
      return { content }
    } catch (e) {
      return { error: true, message: (e as Error).message } as IpcError
    }
  })

  // ── login-to-youtube ─────────────────────────────────────────────────────────
  ipcMain.handle('login-to-youtube', async (): Promise<{ cookiesFile: string } | { cancelled: true } | IpcError> => {
    return new Promise((resolve) => {
      // Use a dedicated persistent session so cookies survive the window closing
      const ytSession = session.fromPartition('persist:youtube-login')

      const loginWin = new BrowserWindow({
        width: 520,
        height: 680,
        title: 'Sign in to YouTube',
        parent: BrowserWindow.getAllWindows()[0],
        modal: true,
        webPreferences: {
          session: ytSession,
          nodeIntegration: false,
          contextIsolation: true,
        }
      })

      loginWin.loadURL('https://accounts.google.com/ServiceLogin?service=youtube&continue=https://www.youtube.com')

      // Detect successful login by watching for YouTube homepage redirect
      loginWin.webContents.on('did-navigate', async (_, url) => {
        if (!url.includes('youtube.com') || url.includes('accounts.google') || url.includes('ServiceLogin')) return

        // Give YouTube a moment to set all cookies
        await new Promise((r) => setTimeout(r, 1500))

        try {
          const cookies = await ytSession.cookies.get({ domain: '.youtube.com' })
          const googleCookies = await ytSession.cookies.get({ domain: '.google.com' })
          const allCookies = [...cookies, ...googleCookies]

          if (allCookies.length === 0) return // Not fully logged in yet

          // Format as Netscape cookies.txt
          const lines = [
            '# Netscape HTTP Cookie File',
            '# Generated by RB-YouTubeTools',
            ''
          ]
          for (const c of allCookies) {
            const domain = c.domain ?? '.youtube.com'
            const flag = domain.startsWith('.') ? 'TRUE' : 'FALSE'
            const path = c.path ?? '/'
            const secure = c.secure ? 'TRUE' : 'FALSE'
            const expiry = c.expirationDate ? Math.floor(c.expirationDate) : 0
            lines.push(`${domain}\t${flag}\t${path}\t${secure}\t${expiry}\t${c.name}\t${c.value}`)
          }

          // Save to userData (not tmpdir) so it persists across app restarts
          const cookiesFile = join(app.getPath('userData'), 'youtube-cookies.txt')
          await writeFile(cookiesFile, lines.join('\n'), 'utf-8')

          loginWin.close()
          resolve({ cookiesFile })
        } catch (e) {
          resolve({ error: true, message: (e as Error).message } as IpcError)
        }
      })

      loginWin.on('closed', () => {
        resolve({ cancelled: true })
      })
    })
  })

  // ── saved cookies ─────────────────────────────────────────────────────────────
  ipcMain.handle('get-saved-cookies', (): { cookiesFile: string } | null => {
    const p = join(app.getPath('userData'), 'youtube-cookies.txt')
    return existsSync(p) ? { cookiesFile: p } : null
  })

  ipcMain.handle('clear-saved-cookies', async () => {
    const p = join(app.getPath('userData'), 'youtube-cookies.txt')
    if (existsSync(p)) {
      const { unlink } = await import('fs/promises')
      await unlink(p).catch(() => {})
    }
  })

  // ── history ──────────────────────────────────────────────────────────────────
  ipcMain.handle('get-history', () => loadHistory())
  ipcMain.handle('delete-history-entry', (_event, id: string) => deleteHistoryEntry(id))

  ipcMain.handle('delete-entry-with-folder', async (_event, id: string) => {
    const entries = loadHistory()
    const entry = entries.find((e) => e.id === id)
    if (entry?.outputDir && existsSync(entry.outputDir)) {
      await rm(entry.outputDir, { recursive: true, force: true })
    }
    deleteHistoryEntry(id)
  })

  ipcMain.handle('download-video-now', async (_event, url: string, outputDir: string) => {
    const win = BrowserWindow.getAllWindows()[0]
    const emit = (pct: number, msg: string) => win?.webContents.send('video-download-progress', pct, msg)
    emit(-1, 'Fetching video info...')
    try {
      const cookiesFile = join(app.getPath('userData'), 'youtube-cookies.txt')
      const cookies = existsSync(cookiesFile) ? cookiesFile : undefined
      const { videoQuality } = loadSettings()
      const videoPath = await downloadVideo(url, outputDir, emit, cookies, videoQuality)
      return { videoPath }
    } catch (e) {
      return { error: true, message: (e as Error).message } as IpcError
    }
  })

  ipcMain.handle('get-stream-url', async (_event, youtubeUrl: string) => {
    try {
      const cookiesFile = join(app.getPath('userData'), 'youtube-cookies.txt')
      const cookies = existsSync(cookiesFile) ? cookiesFile : undefined
      const streamUrl = await getStreamUrl(youtubeUrl, cookies)
      return { streamUrl }
    } catch (e) {
      return { error: true, message: (e as Error).message } as IpcError
    }
  })

  ipcMain.handle('clear-history', () => clearHistory())

  // ── settings ─────────────────────────────────────────────────────────────────
  ipcMain.handle('get-settings', (): AppSettings => loadSettings())

  ipcMain.handle('save-settings', (_event, settings: AppSettings) => {
    if (settings.outputDir && !existsSync(settings.outputDir)) {
      try { mkdirSync(settings.outputDir, { recursive: true }) } catch {}
    }
    saveSettings(settings)
  })

  ipcMain.handle('get-app-version', (): string => app.getVersion())

  ipcMain.handle('uninstall-app', async () => {
    // Open Windows Apps & Features so the user can trigger uninstall
    await shell.openExternal('ms-settings:appsfeatures')
  })

  // ── clear-output-dir ─────────────────────────────────────────────────────────
  // Deletes the entire output directory from disk and also wipes history,
  // since history entries would point to non-existent paths.
  ipcMain.handle('clear-output-dir', async () => {
    const { outputDir } = loadSettings()
    if (outputDir && existsSync(outputDir)) {
      await rm(outputDir, { recursive: true, force: true })
    }
    clearHistory()
  })

  // ── backfill-history ─────────────────────────────────────────────────────────
  // Scan the default output dir for folders that have VTT/SRT files but aren't
  // in history.json yet — so old translations show up automatically.
  ipcMain.handle('backfill-history', async (): Promise<{ added: number }> => {
    const outputDir = loadSettings().outputDir
    if (!existsSync(outputDir)) return { added: 0 }

    const existing = loadHistory()
    const existingDirs = new Set(existing.map((e) => e.outputDir))

    let added = 0
    let subdirs: string[] = []
    try {
      subdirs = readdirSync(outputDir).filter((name) => {
        const full = join(outputDir, name)
        return statSync(full).isDirectory()
      })
    } catch { return { added: 0 } }

    for (const folderName of subdirs) {
      const folderPath = join(outputDir, folderName)
      if (existingDirs.has(folderPath)) continue

      let files: string[] = []
      try { files = readdirSync(folderPath) } catch { continue }

      const vttFiles = files.filter((f) => f.endsWith('.vtt'))
      const srtFiles = files.filter((f) => f.endsWith('.srt'))
      const videoFiles = files.filter((f) => f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.webm'))

      const subFile = vttFiles[0] ?? srtFiles[0]
      if (!subFile) continue

      // Extract target lang from filename: title_en.vtt → 'en'
      const langMatch = subFile.replace(/\.(vtt|srt)$/, '').match(/_([a-z]{2}(?:-[A-Z]{2})?)$/)
      const targetLang = langMatch?.[1] ?? 'unknown'

      // Count blocks by reading the file
      let blockCount = 0
      try {
        const content = await fsReadFile(join(folderPath, subFile), 'utf-8')
        blockCount = (content.match(/^\d+$/m) ? content.split(/\n\n+/).filter((b) => /^\d+\n/.test(b.trim())).length : content.split(/\n\n+/).filter((b) => b.includes('-->')).length)
      } catch {}

      const videoPath = videoFiles.length > 0 ? join(folderPath, videoFiles[0]) : undefined
      const srtPath = srtFiles.length > 0 ? join(folderPath, srtFiles[0]) : ''
      const vttPath = vttFiles.length > 0 ? join(folderPath, vttFiles[0]) : ''

      const entry = {
        id: `backfill-${folderPath}`,
        date: new Date().toISOString(),
        videoTitle: folderName,
        videoId: '',
        thumbnailUrl: '',
        targetLang,
        blockCount,
        srtPath,
        vttPath,
        videoPath,
        outputDir: folderPath
      }

      existing.push(entry)
      existingDirs.add(folderPath)
      added++
    }

    if (added > 0) {
      const { writeFileSync } = require('fs')
      const histPath = join(app.getPath('userData'), 'history.json')
      // Sort newest first (backfilled entries go to end, real entries at top)
      writeFileSync(histPath, JSON.stringify(existing.slice(0, 50), null, 2), 'utf-8')
    }

    return { added }
  })
}

async function runJob(
  jobId: string,
  options: JobOptions,
  emit: (e: Omit<JobProgressEvent, 'jobId'>) => void
): Promise<void> {
  const { url, targetLang, sourceLang, downloadVideo: shouldDownloadVideo, videoQuality, outputDir, cookiesBrowser, cookiesFile } = options

  try {
    // Stage 1: Fetch video info to get a clean folder name
    emit({
      stage: 'fetch-captions',
      stageStatus: 'active',
      message: 'Fetching video info...',
      status: 'running'
    })

    let videoInfo = await getVideoInfo(url).catch(() => null)
    // Sanitize title for use as folder name
    const safeTitle = (videoInfo?.title ?? jobId).replace(/[<>:"/\\|?*]/g, '_').slice(0, 80)
    const videoOutputDir = join(outputDir, safeTitle)
    if (!existsSync(videoOutputDir)) mkdirSync(videoOutputDir, { recursive: true })

    emit({
      stage: 'fetch-captions',
      stageStatus: 'active',
      message: 'Fetching captions from YouTube...',
      status: 'running'
    })

    const srtRaw = await downloadCaptions(url, videoOutputDir, cookiesBrowser, cookiesFile, (msg) => {
      emit({ stage: 'fetch-captions', stageStatus: 'active', message: msg, status: 'running' })
    }, sourceLang)

    emit({
      stage: 'fetch-captions',
      stageStatus: 'done',
      message: 'Captions downloaded successfully.',
      status: 'running'
    })

    // Stage 2: Parse captions
    emit({
      stage: 'parse-captions',
      stageStatus: 'active',
      message: 'Parsing subtitle file...',
      status: 'running'
    })

    const blocks = parseSubtitleFile(srtRaw)

    emit({
      stage: 'parse-captions',
      stageStatus: 'done',
      message: `Parsed ${blocks.length} subtitle blocks.`,
      status: 'running'
    })

    // Write original (untranslated) VTT so users can switch tracks in the player
    const videoTitle = videoInfo?.title ?? 'translated'
    const safeBase = videoTitle.replace(/[<>:"/\\|?*]/g, '_').slice(0, 80)
    let originalVttPath: string | undefined
    try {
      const { srtToVtt, assembleSrt } = await import('./services/captionParser')
      const { writeFile: wf } = await import('fs/promises')
      const originalVtt = srtToVtt(assembleSrt(blocks))
      originalVttPath = join(videoOutputDir, `${safeBase}_original.vtt`)
      await wf(originalVttPath, originalVtt, 'utf-8')
    } catch {}

    // Stage 3: Translate
    emit({
      stage: 'translate',
      stageStatus: 'active',
      message: `Translating ${blocks.length} blocks to ${targetLang}...`,
      percent: 0,
      status: 'running'
    })

    const translated = await translateBlocks(blocks, targetLang, (pct, done, total) => {
      emit({
        stage: 'translate',
        stageStatus: 'active',
        message: `Translated ${done}/${total} blocks...`,
        percent: pct,
        status: 'running'
      })
    })

    emit({
      stage: 'translate',
      stageStatus: 'done',
      message: 'Translation complete.',
      percent: 100,
      status: 'running'
    })

    // Stage 4: Write output
    emit({
      stage: 'write-output',
      stageStatus: 'active',
      message: 'Writing translated caption files...',
      status: 'running'
    })

    const { srtPath, vttPath } = await writeSrtAndVtt(translated, videoOutputDir, videoTitle, targetLang)

    emit({
      stage: 'write-output',
      stageStatus: 'done',
      message: 'Caption files saved.',
      status: 'running'
    })

    let videoPath: string | undefined

    // Stage 5 (optional): Download video
    if (shouldDownloadVideo) {
      emit({
        stage: 'download-video',
        stageStatus: 'active',
        message: 'Downloading video...',
        percent: 0,
        status: 'running'
      })

      videoPath = await downloadVideo(url, videoOutputDir, (pct, msg) => {
        emit({
          stage: 'download-video',
          stageStatus: 'active',
          message: msg,
          percent: pct >= 0 ? pct : undefined,
          status: 'running'
        })
      }, undefined, videoQuality)

      emit({
        stage: 'download-video',
        stageStatus: 'done',
        message: 'Video downloaded.',
        percent: 100,
        status: 'running'
      })
    }

    const result: JobResult = {
      srtPath,
      vttPath,
      originalVttPath,
      videoPath,
      outputDir: videoOutputDir,
      blockCount: translated.length,
      videoTitle,
      videoId: videoInfo?.videoId
    }

    // Save to history
    try {
      const urlObj = new URL(url)
      const videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop() || jobId
      saveHistoryEntry({
        id: jobId,
        date: new Date().toISOString(),
        videoTitle,
        videoId,
        thumbnailUrl: videoInfo?.thumbnailUrl ?? '',
        targetLang,
        sourceLang,
        blockCount: translated.length,
        srtPath,
        vttPath,
        originalVttPath,
        videoPath,
        outputDir: videoOutputDir
      })
    } catch {}

    emit({
      stage: 'write-output',
      stageStatus: 'done',
      message: 'All done!',
      status: 'done',
      result
    })
  } catch (e) {
    const message = (e as Error).message || 'Unknown error'
    emit({
      stage: 'fetch-captions',
      stageStatus: 'error',
      message: `Error: ${message}`,
      status: 'error',
      error: message
    })
  }
}
