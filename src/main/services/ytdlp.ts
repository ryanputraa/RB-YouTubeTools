import { spawn, spawnSync } from 'child_process'
import { join } from 'path'
import { existsSync, mkdirSync, chmodSync, readdirSync, copyFileSync, renameSync } from 'fs'
import { writeFile } from 'fs/promises'
import { app, net } from 'electron'
import { tmpdir } from 'os'
import type { VideoInfo, FfmpegStatus } from '@shared/types'

const IS_WIN = process.platform === 'win32'
const IS_MAC = process.platform === 'darwin'
const BIN_NAME = IS_WIN ? 'yt-dlp.exe' : 'yt-dlp'
const FFMPEG_NAME = IS_WIN ? 'ffmpeg.exe' : 'ffmpeg'

// ── Binary resolution ─────────────────────────────────────────────────────────

export async function resolveBinary(): Promise<{ path: string; version: string }> {
  // 1. Check PATH
  const which = IS_WIN ? 'where' : 'which'
  const fromPath = spawnSync(which, [IS_WIN ? 'yt-dlp.exe' : 'yt-dlp'], { encoding: 'utf-8' })
  if (fromPath.status === 0 && fromPath.stdout.trim()) {
    const binPath = fromPath.stdout.trim().split('\n')[0].trim()
    const version = getBinaryVersion(binPath)
    return { path: binPath, version }
  }

  // 2. Check userData/bin/
  const userDataBin = join(app.getPath('userData'), 'bin', BIN_NAME)
  if (existsSync(userDataBin)) {
    const version = getBinaryVersion(userDataBin)
    return { path: userDataBin, version }
  }

  // 3. Check resources/ (packaged app)
  const resourcesBin = join(process.resourcesPath ?? '', 'yt-dlp', BIN_NAME)
  if (existsSync(resourcesBin)) {
    const version = getBinaryVersion(resourcesBin)
    return { path: resourcesBin, version }
  }

  throw new Error('yt-dlp not found. Please install it or use the setup screen to download it.')
}

function getBinaryVersion(binPath: string): string {
  try {
    const result = spawnSync(binPath, ['--version'], { encoding: 'utf-8' })
    return result.stdout.trim() || 'unknown'
  } catch {
    return 'unknown'
  }
}

// ── Download yt-dlp binary ────────────────────────────────────────────────────

export async function downloadYtdlpBinary(
  onProgress: (pct: number, msg: string) => void
): Promise<string> {
  let downloadUrl: string
  if (IS_WIN) {
    downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
  } else if (IS_MAC) {
    downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos'
  } else {
    downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp'
  }

  onProgress(0, 'Downloading yt-dlp binary...')

  const response = await net.fetch(downloadUrl)

  if (!response.ok) {
    throw new Error(`Failed to download yt-dlp: HTTP ${response.status}`)
  }

  const contentLength = Number(response.headers.get('content-length') || 0)
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    if (contentLength > 0) {
      const pct = Math.round((received / contentLength) * 100)
      onProgress(pct, `Downloading... ${pct}%`)
    }
  }

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
  const buffer = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    buffer.set(chunk, offset)
    offset += chunk.length
  }

  const binDir = join(app.getPath('userData'), 'bin')
  if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true })

  const binPath = join(binDir, BIN_NAME)
  await writeFile(binPath, buffer)

  if (!IS_WIN) {
    chmodSync(binPath, 0o755)
  }

  onProgress(100, 'yt-dlp downloaded successfully.')
  return binPath
}

// ── ffmpeg resolution ─────────────────────────────────────────────────────────

export function resolveFfmpeg(): FfmpegStatus {
  // 1. Check PATH
  const which = IS_WIN ? 'where' : 'which'
  const fromPath = spawnSync(which, [FFMPEG_NAME], { encoding: 'utf-8' })
  if (fromPath.status === 0 && fromPath.stdout.trim()) {
    return { found: true, path: fromPath.stdout.trim().split('\n')[0].trim() }
  }
  // 2. Check userData/bin/
  const userDataBin = join(app.getPath('userData'), 'bin', FFMPEG_NAME)
  if (existsSync(userDataBin)) return { found: true, path: userDataBin }
  // 3. Check resources/
  const resourcesBin = join(process.resourcesPath ?? '', 'ffmpeg', FFMPEG_NAME)
  if (existsSync(resourcesBin)) return { found: true, path: resourcesBin }
  return { found: false }
}

export async function downloadFfmpegBinary(
  onProgress: (pct: number, msg: string) => void
): Promise<string> {
  let downloadUrl: string
  if (IS_WIN) {
    downloadUrl = 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'
  } else if (IS_MAC) {
    downloadUrl = 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-macos64-gpl.zip'
  } else {
    downloadUrl = 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz'
  }

  onProgress(0, 'Downloading ffmpeg...')
  const response = await net.fetch(downloadUrl)
  if (!response.ok) throw new Error(`Failed to download ffmpeg: HTTP ${response.status}`)

  const contentLength = Number(response.headers.get('content-length') || 0)
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const chunks: Uint8Array[] = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    if (contentLength > 0) {
      const pct = Math.round((received / contentLength) * 90)
      onProgress(pct, `Downloading... ${pct}%`)
    }
  }

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
  const buffer = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length }

  const binDir = join(app.getPath('userData'), 'bin')
  if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true })

  onProgress(91, 'Extracting ffmpeg...')

  const archivePath = join(binDir, IS_WIN ? 'ffmpeg.zip' : IS_MAC ? 'ffmpeg.zip' : 'ffmpeg.tar.xz')
  await writeFile(archivePath, buffer)

  const extractDir = join(binDir, 'ffmpeg-extract')
  if (!existsSync(extractDir)) mkdirSync(extractDir, { recursive: true })

  if (IS_WIN || IS_MAC) {
    // Use PowerShell on Windows, unzip on Mac
    const extractCmd = IS_WIN
      ? spawnSync('powershell', ['-Command', `Expand-Archive -Path "${archivePath}" -DestinationPath "${extractDir}" -Force`])
      : spawnSync('unzip', ['-o', archivePath, '-d', extractDir])
    if (extractCmd.status !== 0) {
      throw new Error(`Failed to extract ffmpeg archive: ${extractCmd.stderr?.toString()}`)
    }
  } else {
    const extractCmd = spawnSync('tar', ['-xf', archivePath, '-C', extractDir])
    if (extractCmd.status !== 0) throw new Error('Failed to extract ffmpeg archive')
  }

  // Find ffmpeg binary in extracted folder (it's nested inside a subdirectory)
  const findFfmpeg = (dir: string): string | undefined => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        const found = findFfmpeg(full)
        if (found) return found
      } else if (entry.name === FFMPEG_NAME) {
        return full
      }
    }
    return undefined
  }

  const foundBin = findFfmpeg(extractDir)
  if (!foundBin) throw new Error('ffmpeg binary not found in archive')

  const destPath = join(binDir, FFMPEG_NAME)
  copyFileSync(foundBin, destPath)
  if (!IS_WIN) chmodSync(destPath, 0o755)

  onProgress(100, 'ffmpeg downloaded successfully.')
  return destPath
}

// ── Common yt-dlp extra args ──────────────────────────────────────────────────

function getCommonArgs(): string[] {
  const args: string[] = []

  // Pass ffmpeg location if found
  const ff = resolveFfmpeg()
  if (ff.found && ff.path) {
    args.push('--ffmpeg-location', ff.path)
  }

  // Pass Node.js as JS runtime if available
  const which = IS_WIN ? 'where' : 'which'
  const nodeLookup = spawnSync(which, ['node'], { encoding: 'utf-8' })
  if (nodeLookup.status === 0 && nodeLookup.stdout.trim()) {
    const nodePath = nodeLookup.stdout.trim().split('\n')[0].trim()
    args.push('--js-runtimes', `node:${nodePath}`)
  }

  return args
}

// ── Video Info ────────────────────────────────────────────────────────────────

export async function getVideoInfo(url: string): Promise<VideoInfo> {
  const { path: bin } = await resolveBinary()

  return new Promise((resolve, reject) => {
    const args = ['--dump-json', '--no-download', '--no-playlist', ...getCommonArgs(), url]
    const proc = spawn(bin, args, { encoding: 'utf-8' } as any)

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (d: Buffer) => (stdout += d.toString()))
    proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()))

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`))
        return
      }
      try {
        const data = JSON.parse(stdout.trim())
        const info: VideoInfo = {
          url,
          videoId: data.id || '',
          title: data.title || 'Unknown Title',
          channelName: data.channel || data.uploader || 'Unknown Channel',
          durationSeconds: data.duration || 0,
          thumbnailUrl: data.thumbnail || ''
        }
        resolve(info)
      } catch (e) {
        reject(new Error(`Failed to parse yt-dlp output: ${(e as Error).message}`))
      }
    })

    proc.on('error', (e) => reject(new Error(`Failed to spawn yt-dlp: ${e.message}`)))
  })
}

// ── Download Captions ─────────────────────────────────────────────────────────

export async function downloadCaptions(
  url: string,
  outputDir: string,
  cookiesBrowser: string | undefined,
  cookiesFile: string | undefined,
  onLog: (msg: string) => void
): Promise<string> {
  const { path: bin } = await resolveBinary()

  // Fallback chain: auto en → auto en.* variants → manual en.*
  // Never use .* (all langs) — it downloads 150 subtitles and hammers the API
  const content = await tryDownloadCaptions(bin, url, 'en', true, cookiesBrowser, cookiesFile, onLog)
    .catch(() => tryDownloadCaptions(bin, url, 'en.*', true, cookiesBrowser, cookiesFile, onLog))
    .catch(() => tryDownloadCaptions(bin, url, 'en.*', false, cookiesBrowser, cookiesFile, onLog))

  return content
}

async function tryDownloadCaptions(
  bin: string,
  url: string,
  subLang: string,
  autoSubs: boolean,
  cookiesBrowser: string | undefined,
  cookiesFile: string | undefined,
  onLog: (msg: string) => void
): Promise<string> {
  const tmpOut = join(tmpdir(), `-${Date.now()}`)

  const args = [
    '--skip-download',
    autoSubs ? '--write-auto-subs' : '--write-subs',
    '--sub-langs', subLang,
    '--no-playlist',
    '--retries', '3',
    '--sleep-requests', '1',
    ...getCommonArgs(),
  ]

  if (cookiesFile) {
    args.push('--cookies', cookiesFile)
  } else if (cookiesBrowser) {
    args.push('--cookies-from-browser', cookiesBrowser)
  }

  args.push('-o', join(tmpOut, '%(title)s'), url)

  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args)
    let stderr = ''

    proc.stderr.on('data', (d: Buffer) => {
      const line = d.toString().trim()
      stderr += line + '\n'
      if (line) onLog(line)
    })

    proc.stdout.on('data', (d: Buffer) => {
      const line = d.toString().trim()
      if (line) onLog(line)
    })

    proc.on('close', () => {
      // Check for files regardless of exit code — yt-dlp exits non-zero even
      // when some subtitles downloaded successfully (e.g. 429 on extra langs)
      if (!existsSync(tmpOut)) {
        reject(new Error(`No captions directory created. yt-dlp output:\n${stderr}`))
        return
      }

      let subFile: string | undefined
      try {
        const files = readdirSync(tmpOut)
        // Prefer .srt, fall back to .vtt (YouTube delivers VTT natively)
        subFile = files.find((f) => f.endsWith('.srt')) ?? files.find((f) => f.endsWith('.vtt'))
      } catch {
        reject(new Error('Could not read temp directory'))
        return
      }

      if (!subFile) {
        reject(new Error(`No subtitle file found. yt-dlp output:\n${stderr}`))
        return
      }

      const { readFileSync } = require('fs')
      try {
        const content = readFileSync(join(tmpOut, subFile), 'utf-8')
        resolve(content)
      } catch (e) {
        reject(new Error(`Failed to read subtitle file: ${(e as Error).message}`))
      }
    })

    proc.on('error', (e) => reject(new Error(`Failed to spawn yt-dlp: ${e.message}`)))
  })
}

// ── Download Video ────────────────────────────────────────────────────────────

export async function downloadVideo(
  url: string,
  outputDir: string,
  onProgress: (pct: number, msg: string) => void
): Promise<string> {
  const { path: bin } = await resolveBinary()

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

  const outputTemplate = join(outputDir, '%(title)s.%(ext)s')
  const args = [
    '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
    '--merge-output-format', 'mp4',
    '--no-playlist',
    ...getCommonArgs(),
    '-o', outputTemplate,
    '--newline',
    url
  ]

  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args)
    let lastFile = ''
    let stderr = ''

    const progressRegex = /\[download\]\s+(\d+(?:\.\d+)?)%/

    proc.stdout.on('data', (d: Buffer) => {
      const text = d.toString()
      const lines = text.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        const match = trimmed.match(progressRegex)
        if (match) {
          const pct = parseFloat(match[1])
          onProgress(pct, `Downloading video: ${pct.toFixed(1)}%`)
        } else {
          onProgress(-1, trimmed)
        }

        // Track output filename
        const destMatch = trimmed.match(/\[download\] Destination: (.+)/)
        if (destMatch) lastFile = destMatch[1].trim()

        const mergeMatch = trimmed.match(/\[Merger\] Merging formats into "(.+)"/)
        if (mergeMatch) lastFile = mergeMatch[1].trim()
      }
    })

    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString()
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Video download failed (code ${code}): ${stderr}`))
        return
      }
      if (!lastFile || !existsSync(lastFile)) {
        // Try to find any mp4 in outputDir
        try {
          const files = readdirSync(outputDir)
          const mp4 = files.find((f) => f.endsWith('.mp4'))
          if (mp4) {
            resolve(join(outputDir, mp4))
            return
          }
        } catch {}
        reject(new Error('Video file not found after download'))
        return
      }
      resolve(lastFile)
    })

    proc.on('error', (e) => reject(new Error(`Failed to spawn yt-dlp: ${e.message}`)))
  })
}
