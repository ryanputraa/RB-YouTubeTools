import React, { useState, useEffect, useRef } from 'react'
import type { AppSettings, VideoQuality } from '@shared/types'
import ConfirmModal from '../components/ConfirmModal'

declare const __APP_VERSION__: string

interface SettingsScreenProps {
  onBack: () => void
}

const QUALITY_OPTIONS: { value: VideoQuality; label: string; sub: string }[] = [
  { value: 'best',   label: 'Best available', sub: 'Highest quality the video offers' },
  { value: '2160p',  label: '4K (2160p)',      sub: 'Ultra HD — large file size' },
  { value: '1080p',  label: '1080p HD',         sub: 'Full HD — recommended' },
  { value: '720p',   label: '720p HD',          sub: 'Good balance of quality & size' },
  { value: '480p',   label: '480p',             sub: 'Standard definition' },
  { value: '360p',   label: '360p',             sub: 'Smallest file size' },
]

type Modal = 'clear-history' | 'clear-downloads' | 'uninstall' | null

export default function SettingsScreen({ onBack }: SettingsScreenProps): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [modal, setModal] = useState<Modal>(null)
  const [version, setVersion] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoad = useRef(true)

  useEffect(() => {
    window.electronAPI.getSettings().then((s) => { setSettings(s); initialLoad.current = false })
    window.electronAPI.getAppVersion().then(setVersion)
  }, [])

  // Autosave 600ms after the last change
  useEffect(() => {
    if (initialLoad.current || !settings) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveState('saving')
    saveTimer.current = setTimeout(async () => {
      await window.electronAPI.saveSettings(settings)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1500)
    }, 600)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [settings])

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((s) => s ? { ...s, [key]: value } : s)
  }

  const handleBrowseOutputDir = async () => {
    const result = await window.electronAPI.selectOutputDir()
    if (!('cancelled' in result)) update('outputDir', result.path)
  }

  const handleOpenOutputDir = () => {
    if (settings?.outputDir) window.electronAPI.openFolder(settings.outputDir)
  }

  const modalConfigs: Record<NonNullable<Modal>, {
    title: string
    description: string
    confirmLabel: string
    danger: boolean
    action: () => Promise<void>
  }> = {
    'clear-history': {
      title: 'Clear translation history?',
      description: 'This removes all history entries from the list. Your downloaded files on disk are not affected.',
      confirmLabel: 'Clear history',
      danger: false,
      action: async () => { await window.electronAPI.clearHistory() },
    },
    'clear-downloads': {
      title: 'Delete all downloads?',
      description: 'This permanently deletes your entire output folder from disk and clears translation history. This cannot be undone.',
      confirmLabel: 'Delete all',
      danger: true,
      action: async () => { await window.electronAPI.clearOutputDir() },
    },
    'uninstall': {
      title: 'Uninstall RB YouTube Tools?',
      description: 'This will open Windows Apps & Features where you can uninstall the app.',
      confirmLabel: 'Open uninstaller',
      danger: true,
      action: async () => { await window.electronAPI.uninstallApp() },
    },
  }

  const handleModalConfirm = async () => {
    if (!modal) return
    await modalConfigs[modal].action()
    setModal(null)
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const activeModal = modal ? modalConfigs[modal] : null

  return (
    <>
      {activeModal && (
        <ConfirmModal
          title={activeModal.title}
          description={activeModal.description}
          confirmLabel={activeModal.confirmLabel}
          danger={activeModal.danger}
          onConfirm={handleModalConfirm}
          onCancel={() => setModal(null)}
        />
      )}

      <div className="flex flex-col h-full overflow-y-auto">
        <div className="px-6 pt-5 pb-4 border-b border-white/5 shrink-0 flex items-center gap-3">
          <button onClick={onBack} className="text-white/40 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-white font-semibold text-base">Settings</h2>
          <div className="flex-1" />
          {saveState === 'saving' && (
            <span className="text-xs text-white/30 flex items-center gap-1.5">
              <div className="w-3 h-3 border border-white/20 border-t-white/50 rounded-full animate-spin" />
              Saving…
            </span>
          )}
          {saveState === 'saved' && (
            <span className="text-xs text-accent-green/60 flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
        </div>

        <div className="flex-1 p-6 space-y-6 max-w-xl">

          {/* ── Output directory ── */}
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-white/80">Default Output Directory</h3>
              <p className="text-xs text-white/40 mt-0.5">Where translated captions and downloaded videos are saved</p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.outputDir}
                readOnly
                className="input-field flex-1 text-sm cursor-pointer"
                onClick={handleBrowseOutputDir}
              />
              <button
                onClick={handleBrowseOutputDir}
                className="btn-secondary text-sm shrink-0 px-3"
                title="Browse"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
              </button>
              <button
                onClick={handleOpenOutputDir}
                className="btn-secondary text-sm shrink-0 px-3"
                title="Open folder"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </div>
          </section>

          <div className="border-t border-white/5" />

          {/* ── Default video quality ── */}
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-white/80">Default Video Quality</h3>
              <p className="text-xs text-white/40 mt-0.5">Used when downloading video. Overridable per-download in the options screen.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {QUALITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update('videoQuality', opt.value)}
                  className={`text-left px-3 py-2.5 rounded-xl border transition-colors ${
                    settings.videoQuality === opt.value
                      ? 'bg-primary/20 border-primary/40 text-accent-green'
                      : 'bg-white/3 border-white/8 text-white/60 hover:bg-white/6 hover:text-white/80'
                  }`}
                >
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs opacity-60 mt-0.5">{opt.sub}</p>
                </button>
              ))}
            </div>
          </section>

          <div className="border-t border-white/5" />

          {/* ── Uninstall behaviour ── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-white/80">Uninstall Behaviour</h3>
            <label className="flex items-start gap-3 cursor-pointer group">
              <div
                onClick={() => update('wipeOnUninstall', !settings.wipeOnUninstall)}
                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  settings.wipeOnUninstall
                    ? 'bg-primary border-primary'
                    : 'border-white/20 bg-white/5 group-hover:border-white/40'
                }`}
              >
                {settings.wipeOnUninstall && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div onClick={() => update('wipeOnUninstall', !settings.wipeOnUninstall)}>
                <p className="text-sm text-white/70 group-hover:text-white/90 transition-colors">Delete videos folder on uninstall</p>
                <p className="text-xs text-white/35 mt-0.5">Automatically removes your output directory when the app is uninstalled</p>
              </div>
            </label>
          </section>

          <div className="border-t border-white/5" />

          {/* ── Data management ── */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-white/80">Data</h3>
            <p className="text-xs text-white/35">Manage your local data stored by the app.</p>

            <button
              onClick={() => setModal('clear-history')}
              className="w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors flex items-center gap-3 bg-white/3 border-white/8 text-white/50 hover:bg-white/6 hover:text-white/80"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <div>
                <p>Clear translation history</p>
                <p className="text-xs text-white/30 mt-0.5">Removes history entries — downloaded files on disk are kept</p>
              </div>
            </button>

            <button
              onClick={() => setModal('clear-downloads')}
              className="w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors flex items-center gap-3 bg-white/3 border-white/8 text-white/50 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <div>
                <p>Delete all downloads</p>
                <p className="text-xs text-white/30 mt-0.5">Permanently deletes the output folder + clears history</p>
              </div>
            </button>
          </section>

          <div className="border-t border-white/5" />

          {/* ── Danger zone ── */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-red-400/70">Danger Zone</h3>
            <button
              onClick={() => setModal('uninstall')}
              className="w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors flex items-center gap-3 bg-white/3 border-white/8 text-white/50 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
              </svg>
              Uninstall RB YouTube Tools
            </button>
          </section>

          {/* ── App info ── */}
          <p className="text-xs text-white/20 pb-2">
            RB YouTube Tools — v{version || __APP_VERSION__}
          </p>

        </div>
      </div>
    </>
  )
}
