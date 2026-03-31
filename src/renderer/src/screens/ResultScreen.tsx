import React, { useState, useEffect } from 'react'
import type { JobResult } from '@shared/types'
import VideoPlayer from '../components/VideoPlayer'
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
  const [fileServerPort, setFileServerPort] = useState<number>(0)
  const [activeTab, setActiveTab] = useState<'viewer' | 'captions'>(
    result.videoPath ? 'viewer' : 'captions'
  )

  useEffect(() => {
    window.electronAPI.getFileServerPort().then(setFileServerPort)
    window.electronAPI.readFile(result.vttPath).then((res) => {
      if (!('error' in res)) {
        setVttContent(res.content)
      }
    })
  }, [result.vttPath])

  const handleOpenFolder = () => {
    window.electronAPI.openFolder(result.outputDir)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0">
        <div className="space-y-0.5">
          <h2 className="font-semibold text-white text-sm">{result.videoTitle}</h2>
          <p className="text-white/40 text-xs">
            {result.blockCount} subtitle blocks translated
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenFolder}
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            Open Folder
          </button>
          <button onClick={onReset} className="btn-primary text-sm">
            New Translation
          </button>
        </div>
      </div>

      {/* Tab bar (only if video present) */}
      {result.videoPath && (
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
        {activeTab === 'viewer' && result.videoPath && fileServerPort ? (
          <VideoPlayer
            videoUrl={toFileServerUrl(result.videoPath, fileServerPort)}
            vttContent={vttContent}
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
        {result.videoPath && (
          <span className="truncate shrink-0">
            <span className="text-white/50 font-medium">Video: </span>
            {result.videoPath}
          </span>
        )}
      </div>
    </div>
  )
}
