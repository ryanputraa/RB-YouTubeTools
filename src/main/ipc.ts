import { ipcMain, dialog, shell, BrowserWindow, app, session } from 'electron'
import { readFile as fsReadFile, writeFile } from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { getFileServerPort } from './services/fileServer'
import {
  resolveBinary,
  getVideoInfo,
  downloadCaptions,
  downloadVideo,
  downloadYtdlpBinary,
  resolveFfmpeg,
  downloadFfmpegBinary
} from './services/ytdlp'
import { parseSubtitleFile } from './services/captionParser'
import { translateBlocks } from './services/translator'
import { writeSrtAndVtt } from './services/srtWriter'
import { saveHistoryEntry, loadHistory, deleteHistoryEntry, clearHistory } from './services/history'
import type { JobOptions, JobProgressEvent, JobResult, YtdlpStatus, IpcError } from '@shared/types'

export function registerAllIpcHandlers(): void {
  // ── get-file-server-port ─────────────────────────────────────────────────────
  ipcMain.handle('get-file-server-port', () => getFileServerPort())

  // ── get-default-output-dir ───────────────────────────────────────────────────
  ipcMain.handle('get-default-output-dir', (): string => {
    const dir = join(app.getPath('videos'), 'RB-YouTubeTools')
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

          const cookiesFile = join(tmpdir(), 'rb-ytt-cookies.txt')
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

  // ── history ──────────────────────────────────────────────────────────────────
  ipcMain.handle('get-history', () => loadHistory())
  ipcMain.handle('delete-history-entry', (_event, id: string) => deleteHistoryEntry(id))
  ipcMain.handle('clear-history', () => clearHistory())
}

async function runJob(
  jobId: string,
  options: JobOptions,
  emit: (e: Omit<JobProgressEvent, 'jobId'>) => void
): Promise<void> {
  const { url, targetLang, downloadVideo: shouldDownloadVideo, outputDir, cookiesBrowser, cookiesFile } = options

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
    })

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

    const videoTitle = videoInfo?.title ?? 'translated'
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
      })

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
      videoPath,
      outputDir: videoOutputDir,
      blockCount: translated.length,
      videoTitle
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
        blockCount: translated.length,
        srtPath,
        vttPath,
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
