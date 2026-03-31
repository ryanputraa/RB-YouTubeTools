import { spawn, spawnSync } from 'child_process'
import { join, basename } from 'path'
import { existsSync, mkdirSync, chmodSync, readdirSync } from 'fs'
import { writeFile } from 'fs/promises'
import { app, net } from 'electron'
import { tmpdir } from 'os'
import type { VideoInfo } from '@shared/types'

const IS_WIN = process.platform === 'win32'
const IS_MAC = process.platform === 'darwin'
const BIN_NAME = IS_WIN ? 'yt-dlp.exe' : 'yt-dlp'

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

// ── Video Info ────────────────────────────────────────────────────────────────

export async function getVideoInfo(url: string): Promise<VideoInfo> {
  const { path: bin } = await resolveBinary()

  return new Promise((resolve, reject) => {
    const args = ['--dump-json', '--no-download', '--no-playlist', url]
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
  onLog: (msg: string) => void
): Promise<string> {
  const { path: bin } = await resolveBinary()

  // Try auto-generated subtitles in English first, then any language
  const srtContent = await tryDownloadCaptions(bin, url, outputDir, 'en', onLog)
    .catch(() => tryDownloadCaptions(bin, url, outputDir, 'en-orig', onLog))
    .catch(() => tryDownloadCaptions(bin, url, outputDir, '.*', onLog))

  return srtContent
}

async function tryDownloadCaptions(
  bin: string,
  url: string,
  outputDir: string,
  subLang: string,
  onLog: (msg: string) => void
): Promise<string> {
  const tmpOut = join(tmpdir(), `rb-yt-${Date.now()}`)

  const args = [
    '--skip-download',
    '--write-auto-subs',
    '--convert-subs', 'srt',
    '--sub-lang', subLang,
    '--no-playlist',
    '-o', `${tmpOut}/%(title)s`,
    url
  ]

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

    proc.on('close', (code) => {
      if (!existsSync(tmpOut)) {
        reject(new Error('No captions directory created'))
        return
      }

      // Find the .srt file
      let srtFile: string | undefined
      try {
        const files = readdirSync(tmpOut)
        srtFile = files.find((f) => f.endsWith('.srt'))
      } catch {
        reject(new Error('Could not read temp directory'))
        return
      }

      if (!srtFile) {
        reject(new Error(`No SRT file found. yt-dlp output:\n${stderr}`))
        return
      }

      const { readFileSync } = require('fs')
      try {
        const content = readFileSync(join(tmpOut, srtFile), 'utf-8')
        resolve(content)
      } catch (e) {
        reject(new Error(`Failed to read SRT file: ${(e as Error).message}`))
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
