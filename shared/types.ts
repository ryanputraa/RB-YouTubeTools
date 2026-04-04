// ── Video Info ────────────────────────────────────────────────────────────────

export interface CaptionTrack {
  lang: string      // BCP-47 code e.g. "ko", "en"
  langName: string  // display name e.g. "Korean"
  isAuto: boolean   // auto-generated vs manual
}

export interface VideoInfo {
  url: string
  videoId: string
  title: string
  channelName: string
  durationSeconds: number
  thumbnailUrl: string
  availableCaptions: CaptionTrack[]   // orig-language auto + all manual
  allAutoCaptions: CaptionTrack[]     // every auto track (150+), for edge cases
}

// ── Subtitle Structures ───────────────────────────────────────────────────────

export interface SubtitleBlock {
  index: number
  startTime: string // "HH:MM:SS,mmm"
  endTime: string   // "HH:MM:SS,mmm"
  text: string      // plain text, HTML tags stripped
}

// ── Settings ──────────────────────────────────────────────────────────────────

export type VideoQuality = 'best' | '2160p' | '1080p' | '720p' | '480p' | '360p'

export interface AppSettings {
  outputDir: string
  videoQuality: VideoQuality
  wipeOnUninstall: boolean
}

// ── Job ───────────────────────────────────────────────────────────────────────

export interface JobOptions {
  url: string
  targetLang: string   // BCP-47 code e.g. "fr", "es", "zh-TW"
  sourceLang?: string  // caption track to translate from (default: auto-detect 'en')
  downloadVideo: boolean
  videoQuality?: VideoQuality
  outputDir: string
  cookiesBrowser?: string  // e.g. "chrome", "firefox", "edge"
  cookiesFile?: string     // path to a cookies.txt file
}

export interface JobResult {
  srtPath: string
  vttPath: string
  originalVttPath?: string
  videoPath?: string
  outputDir: string
  blockCount: number
  videoTitle: string
  videoId?: string
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

export interface FfmpegStatus {
  found: boolean
  path?: string
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

export interface HistoryEntry {
  id: string
  date: string
  videoTitle: string
  videoId: string
  thumbnailUrl: string
  targetLang: string
  sourceLang?: string
  blockCount: number
  srtPath: string
  vttPath: string
  originalVttPath?: string
  videoPath?: string
  outputDir: string
}

export interface ElectronAPI {
  getFileServerPort: () => Promise<number>
  getVideoInfo: (url: string) => Promise<VideoInfo | IpcError>
  startJob: (options: JobOptions) => Promise<{ jobId: string } | IpcError>
  checkYtdlp: () => Promise<YtdlpStatus>
  downloadYtdlp: (onProgress: (pct: number, msg: string) => void) => Promise<{ success: boolean; path: string } | IpcError>
  checkFfmpeg: () => Promise<FfmpegStatus>
  downloadFfmpeg: (onProgress: (pct: number, msg: string) => void) => Promise<{ success: boolean; path: string } | IpcError>
  getDefaultOutputDir: () => Promise<string>
  selectOutputDir: () => Promise<{ path: string } | { cancelled: true }>
  selectCookiesFile: () => Promise<{ path: string } | { cancelled: true }>
  openFolder: (path: string) => Promise<void>
  readFile: (path: string) => Promise<{ content: string } | IpcError>
  onJobProgress: (callback: (event: JobProgressEvent) => void) => () => void
  onYtdlpDownloadProgress: (callback: (pct: number, msg: string) => void) => () => void
  loginToYoutube: () => Promise<{ cookiesFile: string } | { cancelled: true } | IpcError>
  getSavedCookies: () => Promise<{ cookiesFile: string } | null>
  clearSavedCookies: () => Promise<void>
  getHistory: () => Promise<HistoryEntry[]>
  deleteHistoryEntry: (id: string) => Promise<void>
  deleteEntryWithFolder: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
  backfillHistory: () => Promise<{ added: number }>
  getStreamUrl: (youtubeUrl: string) => Promise<{ streamUrl: string } | IpcError>
  downloadVideoNow: (url: string, outputDir: string, onProgress: (pct: number, msg: string) => void) => Promise<{ videoPath: string } | IpcError>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<void>
  getAppVersion: () => Promise<string>
  uninstallApp: () => Promise<void>
  clearOutputDir: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
