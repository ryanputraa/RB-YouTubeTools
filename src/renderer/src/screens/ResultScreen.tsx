import React, { useState, useEffect } from 'react'
import type { JobResult } from '@shared/types'
import VideoPlayer from '../components/VideoPlayer'
import YouTubePlayer from '../components/YouTubePlayer'
import SubtitleViewer from '../components/SubtitleViewer'

interface ResultScreenProps {
  result: JobResult
  onReset: () => void
}

function toFileServerUrl(filePath: string, port: number): string {
  return `http://127.0.0.1:${port}/file?path=${encodeURIComponent(filePath)}`
}

export default function ResultScreen({ result, onReset }: ResultScreenProps): JSX.Element {
  const [vttContent, setVttContent] = useState<string>('')
  const [originalVttContent, setOriginalVttContent] = useState<string>('')
  const [fileServerPort, setFileServerPort] = useState<number>(0)
  const [videoPath, setVideoPath] = useState<string | undefined>(result.videoPath)
  const [activeTab, setActiveTab] = useState<'viewer' | 'captions'>(
    (result.videoPath || result.videoId) ? 'viewer' : 'captions'
  )

  const hasVideo = !!videoPath
  const canEmbed = !hasVideo && !!result.videoId

  useEffect(() => {
    window.electronAPI.getFileServerPort().then(setFileServerPort)
    window.electronAPI.readFile(result.vttPath).then((res) => {
      if (!('error' in res)) setVttContent(res.content)
    })
    if (result.originalVttPath) {
      window.electronAPI.readFile(result.originalVttPath).then((res) => {
        if (!('error' in res)) setOriginalVttContent(res.content)
      })
    }
  }, [result.vttPath, result.originalVttPath])

  const handleOpenFolder = () => window.electronAPI.openFolder(result.outputDir)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onReset}
            className="text-white/40 hover:text-white transition-colors shrink-0"
            title="Back to Caption Translator"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="space-y-0.5 min-w-0">
            <h2 className="font-semibold text-white text-sm truncate">{result.videoTitle}</h2>
            <p className="text-white/40 text-xs">{result.blockCount} subtitle blocks translated</p>
          </div>
        </div>
        <button
          onClick={handleOpenFolder}
          className="btn-secondary text-sm flex items-center gap-1.5 shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
          </svg>
          Open Folder
        </button>
      </div>

      {/* Tab bar */}
      {(hasVideo || canEmbed) && (
        <div className="flex border-b border-white/5 shrink-0">
          {[
            { key: 'viewer', label: 'Video Player' },
            { key: 'captions', label: 'Caption Text' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-white'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'viewer' && hasVideo && fileServerPort ? (
          <VideoPlayer
            videoUrl={toFileServerUrl(videoPath!, fileServerPort)}
            vttContent={vttContent}
            originalVttContent={originalVttContent}
          />
        ) : activeTab === 'viewer' && canEmbed ? (
          <YouTubePlayer
            videoId={result.videoId!}
            vttContent={vttContent}
            originalVttContent={originalVttContent}
            outputDir={result.outputDir}
            onVideoDownloaded={(path) => { setVideoPath(path); setActiveTab('viewer') }}
          />
        ) : (
          <SubtitleViewer vttContent={vttContent} srtPath={result.srtPath} />
        )}
      </div>

      {/* File paths */}
      <div className="px-5 py-3 border-t border-white/5 shrink-0 flex gap-4 text-xs text-white/30 overflow-hidden">
        <span className="truncate">
          <span className="text-white/50 font-medium">SRT: </span>
          {result.srtPath}
        </span>
        {videoPath && (
          <span className="truncate shrink-0">
            <span className="text-white/50 font-medium">Video: </span>
            {videoPath}
          </span>
        )}
      </div>
    </div>
  )
}
