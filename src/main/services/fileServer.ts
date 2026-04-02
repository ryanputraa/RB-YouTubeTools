import { createServer, IncomingMessage, ServerResponse, Server, request as httpRequest } from 'http'
import { request as httpsRequest } from 'https'
import { createReadStream, statSync, existsSync } from 'fs'
import { extname } from 'path'

const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.vtt': 'text/vtt',
  '.srt': 'text/plain',
  '.txt': 'text/plain'
}

let server: Server | null = null
let serverPort = 0

export function startFileServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    if (server) {
      resolve(serverPort)
      return
    }

    server = createServer(handleRequest)

    server.listen(0, '127.0.0.1', () => {
      const addr = server!.address()
      serverPort = typeof addr === 'object' && addr ? addr.port : 0
      resolve(serverPort)
    })

    server.on('error', reject)
  })
}

export function getFileServerPort(): number {
  return serverPort
}

export function stopFileServer(): void {
  server?.close()
  server = null
  serverPort = 0
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  try {
    const url = new URL(req.url ?? '/', `http://127.0.0.1`)

    // ── /proxy — stream a remote URL (YouTube CDN) with Range support ──────────
    if (url.pathname === '/proxy') {
      const remoteUrl = decodeURIComponent(url.searchParams.get('url') ?? '')
      if (!remoteUrl.startsWith('http')) { res.writeHead(400); res.end('Bad request'); return }

      const reqFn = remoteUrl.startsWith('https://') ? httpsRequest : httpRequest
      const forwardHeaders: Record<string, string> = { 'User-Agent': 'Mozilla/5.0' }
      if (req.headers.range) forwardHeaders['Range'] = req.headers.range

      const remoteReq = reqFn(remoteUrl, { headers: forwardHeaders }, (remoteRes) => {
        const outHeaders: Record<string, string | number> = {
          'Content-Type': (remoteRes.headers['content-type'] as string) || 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*'
        }
        if (remoteRes.headers['content-range']) outHeaders['Content-Range'] = remoteRes.headers['content-range'] as string
        if (remoteRes.headers['content-length']) outHeaders['Content-Length'] = remoteRes.headers['content-length'] as string
        res.writeHead(remoteRes.statusCode ?? 200, outHeaders)
        remoteRes.pipe(res)
      })
      remoteReq.on('error', () => { res.writeHead(502); res.end('Proxy error') })
      remoteReq.end()
      return
    }

    const filePath = decodeURIComponent(url.searchParams.get('path') ?? '')

    if (!filePath || !existsSync(filePath)) {
      res.writeHead(404)
      res.end('Not found')
      return
    }

    const ext = extname(filePath).toLowerCase()
    const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream'
    const stats = statSync(filePath)
    const fileSize = stats.size

    const range = req.headers.range
    if (range && mimeType.startsWith('video/')) {
      // Handle range requests for video seeking
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunkSize = end - start + 1

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
        'Access-Control-Allow-Origin': '*'
      })

      createReadStream(filePath, { start, end }).pipe(res)
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*'
      })
      createReadStream(filePath).pipe(res)
    }
  } catch (err) {
    res.writeHead(500)
    res.end('Server error')
  }
}
