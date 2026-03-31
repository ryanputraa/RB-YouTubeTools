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

  getDefaultOutputDir: () => ipcRenderer.invoke('get-default-output-dir'),

  getVideoInfo: (url) => ipcRenderer.invoke('get-video-info', url),

  startJob: (options) => ipcRenderer.invoke('start-job', options),

  selectOutputDir: () => ipcRenderer.invoke('select-output-dir'),

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
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
