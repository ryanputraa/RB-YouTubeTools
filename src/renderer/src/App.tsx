import React, { useState, useEffect } from 'react'
import type { VideoInfo, JobResult } from '@shared/types'
import SetupScreen from './screens/SetupScreen'
import HomeScreen from './screens/HomeScreen'
import OptionsScreen from './screens/OptionsScreen'
import ProgressScreen from './screens/ProgressScreen'
import ResultScreen from './screens/ResultScreen'
import HistoryScreen from './screens/HistoryScreen'
import Logo from './components/Logo'

type AppScreen = 'checking' | 'setup' | 'home' | 'options' | 'progress' | 'result' | 'history'

export default function App(): JSX.Element {
  const [screen, setScreen] = useState<AppScreen>('checking')
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobResult, setJobResult] = useState<JobResult | null>(null)
  const [downloadVideo, setDownloadVideo] = useState(false)
  const [targetLang, setTargetLang] = useState('en')
  const [outputDir, setOutputDir] = useState('')

  // Check yt-dlp and ffmpeg on mount
  useEffect(() => {
    Promise.all([
      window.electronAPI.checkYtdlp(),
      window.electronAPI.checkFfmpeg()
    ]).then(([yt, ff]) => {
      if (yt.found && ff.found) {
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

  const handleJobStarted = (id: string, opts: { downloadVideo: boolean; targetLang: string; outputDir: string; cookiesBrowser?: string; cookiesFile?: string }) => {
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
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-white/5 bg-base shrink-0">
        <div className="flex items-center gap-3">
          <Logo className="h-7 w-auto" />
          <span className="text-white/60 text-sm font-medium tracking-wide">
            YT Video Translator
          </span>
        </div>
        {(screen === 'home' || screen === 'history') && (
          <button
            onClick={() => setScreen(screen === 'history' ? 'home' : 'history')}
            className="text-white/40 hover:text-white transition-colors"
            title="History"
          >
            {screen === 'history' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>
        )}
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

        {screen === 'history' && (
          <HistoryScreen
            onBack={() => setScreen('home')}
            onOpenResult={(result) => {
              setJobResult(result)
              setScreen('result')
            }}
          />
        )}
      </main>
    </div>
  )
}
