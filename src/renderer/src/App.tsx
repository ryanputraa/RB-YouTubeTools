import React, { useState, useEffect, useRef } from 'react'
import type { VideoInfo, JobResult } from '@shared/types'
import SetupScreen from './screens/SetupScreen'
import MenuScreen from './screens/MenuScreen'
import HomeScreen from './screens/HomeScreen'
import OptionsScreen from './screens/OptionsScreen'
import ProgressScreen from './screens/ProgressScreen'
import ResultScreen from './screens/ResultScreen'
import Logo from './components/Logo'

type AppScreen = 'checking' | 'setup' | 'menu' | 'home' | 'options' | 'progress' | 'result'

export default function App(): JSX.Element {
  const [screen, setScreen] = useState<AppScreen>('checking')
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobResult, setJobResult] = useState<JobResult | null>(null)
  const [downloadVideo, setDownloadVideo] = useState(true)

  // Lifted YouTube login state — persists across screen transitions
  const [cookiesFile, setCookiesFile] = useState('')
  const [loginStatus, setLoginStatus] = useState<'idle' | 'logging-in' | 'done'>('idle')
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      window.electronAPI.checkYtdlp(),
      window.electronAPI.checkFfmpeg(),
      window.electronAPI.getSavedCookies()
    ]).then(([yt, ff, saved]) => {
      if (saved) { setCookiesFile(saved.cookiesFile); setLoginStatus('done') }
      setScreen(yt.found && ff.found ? 'menu' : 'setup')
    })
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSetupComplete = () => setScreen('menu')

  const handleVideoFetched = (info: VideoInfo) => {
    setVideoInfo(info)
    setScreen('options')
  }

  const handleJobStarted = (id: string, opts: { downloadVideo: boolean }) => {
    setJobId(id)
    setDownloadVideo(opts.downloadVideo)
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

  const handleLogin = async () => {
    setLoginStatus('logging-in')
    setProfileOpen(false)
    const r = await window.electronAPI.loginToYoutube()
    if ('cookiesFile' in r) { setCookiesFile(r.cookiesFile); setLoginStatus('done') }
    else setLoginStatus('idle')
  }

  const handleSignOut = () => {
    setCookiesFile('')
    setLoginStatus('idle')
    setProfileOpen(false)
    window.electronAPI.clearSavedCookies()
  }

  const isLoggedIn = loginStatus === 'done' || !!cookiesFile

  // Screens where header is visible
  const showHeader = screen !== 'checking' && screen !== 'setup'

  // Where logo click goes
  const handleLogoClick = () => {
    if (screen !== 'checking' && screen !== 'setup' && screen !== 'menu') setScreen('menu')
  }

  // Header title per screen
  const screenTitle: Partial<Record<AppScreen, string>> = {
    home: 'Caption Translator',
    options: 'Caption Translator',
    progress: 'Caption Translator',
    result: 'Caption Translator',
  }

  return (
    <div className="flex flex-col h-full bg-base">
      {/* Header */}
      {showHeader && (
        <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-white/5 bg-base shrink-0">
          <button
            onClick={handleLogoClick}
            className={`flex items-center gap-3 ${screen !== 'menu' ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}`}
          >
            <Logo className="h-7 w-auto" />
            <span className="text-white/60 text-sm font-medium tracking-wide">
              {screenTitle[screen] ?? 'RB YouTube Tools'}
            </span>
          </button>

          {/* Profile dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${
                isLoggedIn ? 'bg-primary/20 text-accent-green' : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
              title="YouTube Account"
            >
              {loginStatus === 'logging-in' ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              ) : isLoggedIn ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Signed in</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  <span>Sign in</span>
                </>
              )}
            </button>

            {profileOpen && loginStatus !== 'logging-in' && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-base-card border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                {isLoggedIn ? (
                  <>
                    <div className="px-3 py-2.5 border-b border-white/5">
                      <p className="text-xs text-white/50">YouTube</p>
                      <p className="text-sm text-accent-green font-medium">Signed in</p>
                    </div>
                    <button onClick={handleSignOut} className="w-full text-left px-3 py-2.5 text-sm text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <div className="px-3 py-2.5 border-b border-white/5">
                      <p className="text-xs text-white/40 leading-relaxed">Sign in for age-restricted or rate-limited videos</p>
                    </div>
                    <button onClick={handleLogin} className="w-full text-left px-3 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      Sign in to YouTube
                    </button>
                    <button
                      onClick={async () => {
                        const r = await window.electronAPI.selectCookiesFile()
                        if (!('cancelled' in r)) { setCookiesFile(r.path); setLoginStatus('done') }
                        setProfileOpen(false)
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
                    >
                      Use cookies.txt file
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </header>
      )}

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

        {screen === 'setup' && <SetupScreen onComplete={handleSetupComplete} />}

        {screen === 'menu' && <MenuScreen onSelect={() => setScreen('home')} />}

        {screen === 'home' && (
          <HomeScreen
            onVideoFetched={handleVideoFetched}
            onOpenResult={(result) => { setJobResult(result); setScreen('result') }}
          />
        )}

        {screen === 'options' && videoInfo && (
          <OptionsScreen
            videoInfo={videoInfo}
            cookiesFile={cookiesFile}
            onBack={() => setScreen('home')}
            onStart={(id, opts) => handleJobStarted(id, opts)}
          />
        )}

        {screen === 'progress' && jobId && (
          <ProgressScreen
            jobId={jobId}
            downloadVideo={downloadVideo}
            onComplete={handleJobComplete}
            onBack={() => setScreen('options')}
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
