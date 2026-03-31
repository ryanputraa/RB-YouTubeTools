// ── Video Info ────────────────────────────────────────────────────────────────

export interface VideoInfo {
  url: string
  videoId: string
  title: string
  channelName: string
  durationSeconds: number
  thumbnailUrl: string
}

// ── Subtitle Structures ───────────────────────────────────────────────────────

export interface SubtitleBlock {
  index: number
  startTime: string // "HH:MM:SS,mmm"
  endTime: string   // "HH:MM:SS,mmm"
  text: string      // plain text, HTML tags stripped
}

// ── Job ───────────────────────────────────────────────────────────────────────

export interface JobOptions {
  url: string
  targetLang: string   // BCP-47 code e.g. "fr", "es", "zh-TW"
  downloadVideo: boolean
  outputDir: string
}

export interface JobResult {
  srtPath: string
  vttPath: string
  videoPath?: string
  outputDir: string
  blockCount: number
  videoTitle: string
}

// ── Progress Events ───────────────────────────────────────────────────────────

export type JobStage =
  | 'fetch-captions'
  | 'parse-captions'
  | 'translate'
  | 'write-output'
  | 'download-video'

export type StageStatus = 'pending' | 'active' | 'done' | 'error'

export interface JobProgressEvent {
  jobId: string
  stage: JobStage
  stageStatus: StageStatus
  message: string
  percent?: number
  status: 'running' | 'done' | 'error'
  result?: JobResult
  error?: string
}

// ── yt-dlp ────────────────────────────────────────────────────────────────────

export interface YtdlpStatus {
  found: boolean
  path?: string
  version?: string
}

// ── IPC Utility ───────────────────────────────────────────────────────────────

export interface IpcError {
  error: true
  message: string
  code?: string
}

export function isIpcError(val: unknown): val is IpcError {
  return typeof val === 'object' && val !== null && (val as IpcError).error === true
}

// ── Preload API Contract ──────────────────────────────────────────────────────

export interface ElectronAPI {
  getFileServerPort: () => Promise<number>
  getVideoInfo: (url: string) => Promise<VideoInfo | IpcError>
  startJob: (options: JobOptions) => Promise<{ jobId: string } | IpcError>
  checkYtdlp: () => Promise<YtdlpStatus>
  downloadYtdlp: (onProgress: (pct: number, msg: string) => void) => Promise<{ success: boolean; path: string } | IpcError>
  selectOutputDir: () => Promise<{ path: string } | { cancelled: true }>
  openFolder: (path: string) => Promise<void>
  readFile: (path: string) => Promise<{ content: string } | IpcError>
  onJobProgress: (callback: (event: JobProgressEvent) => void) => () => void
  onYtdlpDownloadProgress: (callback: (pct: number, msg: string) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
