import { ipcMain, dialog, shell, BrowserWindow, app } from 'electron'
import { readFile as fsReadFile } from 'fs/promises'
import { existsSync } from 'fs'
import { getFileServerPort } from './services/fileServer'
import {
  resolveBinary,
  getVideoInfo,
  downloadCaptions,
  downloadVideo,
  downloadYtdlpBinary
} from './services/ytdlp'
import { parseSrt } from './services/captionParser'
import { translateBlocks } from './services/translator'
import { writeSrtAndVtt } from './services/srtWriter'
import type { JobOptions, JobProgressEvent, JobResult, YtdlpStatus, IpcError } from '@shared/types'

export function registerAllIpcHandlers(): void {
  // ── get-file-server-port ─────────────────────────────────────────────────────
  ipcMain.handle('get-file-server-port', () => getFileServerPort())

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
}

async function runJob(
  jobId: string,
  options: JobOptions,
  emit: (e: Omit<JobProgressEvent, 'jobId'>) => void
): Promise<void> {
  const { url, targetLang, downloadVideo: shouldDownloadVideo, outputDir } = options

  try {
    // Stage 1: Fetch & download captions
    emit({
      stage: 'fetch-captions',
      stageStatus: 'active',
      message: 'Fetching captions from YouTube...',
      status: 'running'
    })

    const srtRaw = await downloadCaptions(url, outputDir, (msg) => {
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

    const blocks = parseSrt(srtRaw)

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

    // Get video title for filename
    let videoTitle = 'translated'
    try {
      const info = await getVideoInfo(url)
      videoTitle = info.title
    } catch {}

    const { srtPath, vttPath } = await writeSrtAndVtt(translated, outputDir, videoTitle, targetLang)

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

      videoPath = await downloadVideo(url, outputDir, (pct, msg) => {
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
      outputDir,
      blockCount: translated.length,
      videoTitle
    }

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
