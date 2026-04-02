import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { ElectronAPI, JobProgressEvent } from '@shared/types'

const api: ElectronAPI = {
  getFileServerPort: () => ipcRenderer.invoke('get-file-server-port'),

  checkYtdlp: () => ipcRenderer.invoke('check-ytdlp'),

  downloadYtdlp: (onProgress) => {
    const handler = (_event: IpcRendererEvent, pct: number, msg: string) => onProgress(pct, msg)
    ipcRenderer.on('ytdlp-download-progress', handler)
    return ipcRenderer.invoke('download-ytdlp').finally(() => {
      ipcRenderer.removeListener('ytdlp-download-progress', handler)
    })
  },

  checkFfmpeg: () => ipcRenderer.invoke('check-ffmpeg'),

  downloadFfmpeg: (onProgress) => {
    const handler = (_event: IpcRendererEvent, pct: number, msg: string) => onProgress(pct, msg)
    ipcRenderer.on('ffmpeg-download-progress', handler)
    return ipcRenderer.invoke('download-ffmpeg').finally(() => {
      ipcRenderer.removeListener('ffmpeg-download-progress', handler)
    })
  },

  getDefaultOutputDir: () => ipcRenderer.invoke('get-default-output-dir'),

  getVideoInfo: (url) => ipcRenderer.invoke('get-video-info', url),

  startJob: (options) => ipcRenderer.invoke('start-job', options),

  selectOutputDir: () => ipcRenderer.invoke('select-output-dir'),
  selectCookiesFile: () => ipcRenderer.invoke('select-cookies-file'),

  openFolder: (path) => ipcRenderer.invoke('open-folder', path),

  readFile: (path) => ipcRenderer.invoke('read-file', path),

  onJobProgress: (callback) => {
    const handler = (_event: IpcRendererEvent, payload: JobProgressEvent) => callback(payload)
    ipcRenderer.on('job-progress', handler)
    return () => ipcRenderer.removeListener('job-progress', handler)
  },

  onYtdlpDownloadProgress: (callback) => {
    const handler = (_event: IpcRendererEvent, pct: number, msg: string) => callback(pct, msg)
    ipcRenderer.on('ytdlp-download-progress', handler)
    return () => ipcRenderer.removeListener('ytdlp-download-progress', handler)
  },

  loginToYoutube: () => ipcRenderer.invoke('login-to-youtube'),
  getSavedCookies: () => ipcRenderer.invoke('get-saved-cookies'),
  clearSavedCookies: () => ipcRenderer.invoke('clear-saved-cookies'),
  getHistory: () => ipcRenderer.invoke('get-history'),
  deleteHistoryEntry: (id) => ipcRenderer.invoke('delete-history-entry', id),
  deleteEntryWithFolder: (id) => ipcRenderer.invoke('delete-entry-with-folder', id),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  backfillHistory: () => ipcRenderer.invoke('backfill-history'),
  getStreamUrl: (youtubeUrl) => ipcRenderer.invoke('get-stream-url', youtubeUrl),
  downloadVideoNow: (url, outputDir, onProgress) => {
    const handler = (_event: IpcRendererEvent, pct: number, msg: string) => onProgress(pct, msg)
    ipcRenderer.on('video-download-progress', handler)
    return ipcRenderer.invoke('download-video-now', url, outputDir).finally(() => {
      ipcRenderer.removeListener('video-download-progress', handler)
    })
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
