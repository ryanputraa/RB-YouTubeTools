import React, { useState, useEffect } from 'react'
import type { VideoInfo, JobResult } from '@shared/types'
import SetupScreen from './screens/SetupScreen'
import HomeScreen from './screens/HomeScreen'
import OptionsScreen from './screens/OptionsScreen'
import ProgressScreen from './screens/ProgressScreen'
import ResultScreen from './screens/ResultScreen'
import Logo from './components/Logo'

type AppScreen = 'checking' | 'setup' | 'home' | 'options' | 'progress' | 'result'

export default function App(): JSX.Element {
  const [screen, setScreen] = useState<AppScreen>('checking')
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobResult, setJobResult] = useState<JobResult | null>(null)
  const [downloadVideo, setDownloadVideo] = useState(false)
  const [targetLang, setTargetLang] = useState('es')
  const [outputDir, setOutputDir] = useState('')

  // Check yt-dlp on mount
  useEffect(() => {
    window.electronAPI.checkYtdlp().then((status) => {
      if (status.found) {
        setScreen('home')
      } else {
        setScreen('setup')
      }
    })
  }, [])

  const handleSetupComplete = () => setScreen('home')

  const handleVideoFetched = (info: VideoInfo) => {
    setVideoInfo(info)
    setScreen('options')
  }

  const handleJobStarted = (id: string, opts: { downloadVideo: boolean; targetLang: string; outputDir: string }) => {
    setJobId(id)
    setDownloadVideo(opts.downloadVideo)
    setTargetLang(opts.targetLang)
    setOutputDir(opts.outputDir)
    setScreen('progress')
  }

  const handleJobComplete = (result: JobResult) => {
    setJobResult(result)
    setScreen('result')
  }

  const handleReset = () => {
    setVideoInfo(null)
    setJobId(null)
    setJobResult(null)
    setScreen('home')
  }

  const handleBackToOptions = () => {
    setScreen('options')
  }

  return (
    <div className="flex flex-col h-full bg-base">
      {/* Titlebar / Header */}
      <header className="flex items-center gap-3 px-5 py-3 border-b border-white/5 bg-base shrink-0">
        <Logo className="h-7 w-auto" />
        <span className="text-white/60 text-sm font-medium tracking-wide">
          YT Video Translator
        </span>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {screen === 'checking' && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-white/50 text-sm">Initializing...</p>
            </div>
          </div>
        )}

        {screen === 'setup' && (
          <SetupScreen onComplete={handleSetupComplete} />
        )}

        {screen === 'home' && (
          <HomeScreen onVideoFetched={handleVideoFetched} />
        )}

        {screen === 'options' && videoInfo && (
          <OptionsScreen
            videoInfo={videoInfo}
            onBack={() => setScreen('home')}
            onStart={handleJobStarted}
          />
        )}

        {screen === 'progress' && jobId && (
          <ProgressScreen
            jobId={jobId}
            downloadVideo={downloadVideo}
            onComplete={handleJobComplete}
            onBack={handleBackToOptions}
          />
        )}

        {screen === 'result' && jobResult && (
          <ResultScreen
            result={jobResult}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  )
}
