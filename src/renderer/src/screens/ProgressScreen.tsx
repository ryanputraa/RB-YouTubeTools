import React, { useState, useEffect, useRef } from 'react'
import type { JobProgressEvent, JobResult, JobStage, StageStatus } from '@shared/types'

interface ProgressScreenProps {
  jobId: string
  downloadVideo: boolean
  onComplete: (result: JobResult) => void
  onBack: () => void
}

interface StageInfo {
  key: JobStage
  label: string
  status: StageStatus
  percent?: number
}

const STAGE_ORDER: JobStage[] = [
  'fetch-captions',
  'parse-captions',
  'translate',
  'write-output',
  'download-video'
]

const STAGE_LABELS: Record<JobStage, string> = {
  'fetch-captions': 'Downloading Captions',
  'parse-captions': 'Parsing Subtitles',
  'translate': 'Translating',
  'write-output': 'Saving Files',
  'download-video': 'Downloading Video'
}

function StageIcon({ status }: { status: StageStatus }) {
  if (status === 'done') {
    return (
      <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )
  }
  if (status === 'active') {
    return <div className="w-4 h-4 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
  }
  if (status === 'error') {
    return (
      <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    )
  }
  return <div className="w-4 h-4 rounded-full border-2 border-white/20" />
}

export default function ProgressScreen({
  jobId,
  downloadVideo,
  onComplete,
  onBack
}: ProgressScreenProps): JSX.Element {
  const [stages, setStages] = useState<StageInfo[]>(() =>
    STAGE_ORDER.filter((s) => s !== 'download-video' || downloadVideo).map((key) => ({
      key,
      label: STAGE_LABELS[key],
      status: 'pending' as StageStatus
    }))
  )
  const [logs, setLogs] = useState<string[]>([])
  const [jobStatus, setJobStatus] = useState<'running' | 'done' | 'error'>('running')
  const [errorMsg, setErrorMsg] = useState('')
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsub = window.electronAPI.onJobProgress((event: JobProgressEvent) => {
      if (event.jobId !== jobId) return

      // Update stage status
      setStages((prev) =>
        prev.map((s) =>
          s.key === event.stage
            ? { ...s, status: event.stageStatus, percent: event.percent }
            : s
        )
      )

      // Add to log
      if (event.message) {
        setLogs((prev) => {
          // Avoid duplicate consecutive messages
          if (prev[prev.length - 1] === event.message) return prev
          return [...prev, event.message]
        })
      }

      if (event.status === 'done' && event.result) {
        setJobStatus('done')
        setTimeout(() => onComplete(event.result!), 800)
      }

      if (event.status === 'error') {
        setJobStatus('error')
        setErrorMsg(event.error || event.message)
      }
    })

    return unsub
  }, [jobId])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Overall progress
  const doneCount = stages.filter((s) => s.status === 'done').length
  const overallPct = Math.round((doneCount / stages.length) * 100)
  const translateStage = stages.find((s) => s.key === 'translate')
  const effectivePct =
    translateStage?.status === 'active' && translateStage.percent != null
      ? Math.round(
          ((doneCount + translateStage.percent / 100) / stages.length) * 100
        )
      : overallPct

  return (
    <div className="flex flex-col h-full p-6 space-y-5 overflow-hidden">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-white">
          {jobStatus === 'error' ? 'Translation Failed' :
           jobStatus === 'done' ? 'Translation Complete!' :
           'Translating...'}
        </h2>
        <p className="text-white/50 text-sm">
          {jobStatus === 'running' && 'Please wait while your captions are being processed.'}
          {jobStatus === 'done' && 'All done! Opening results...'}
          {jobStatus === 'error' && 'An error occurred during translation.'}
        </p>
      </div>

      {/* Overall progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-white/50">
          <span>Overall Progress</span>
          <span>{effectivePct}%</span>
        </div>
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              jobStatus === 'error' ? 'bg-red-500' :
              jobStatus === 'done' ? 'bg-accent-green' :
              'bg-primary'
            }`}
            style={{ width: `${jobStatus === 'done' ? 100 : effectivePct}%` }}
          />
        </div>
      </div>

      {/* Stage list */}
      <div className="card space-y-3">
        {stages.map((stage) => (
          <div key={stage.key} className="flex items-center gap-3">
            <StageIcon status={stage.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${
                  stage.status === 'done' ? 'text-white/70' :
                  stage.status === 'active' ? 'text-white' :
                  stage.status === 'error' ? 'text-red-400' :
                  'text-white/30'
                }`}>
                  {stage.label}
                </span>
                {stage.status === 'active' && stage.percent != null && (
                  <span className="text-xs text-accent-blue">{stage.percent}%</span>
                )}
              </div>
              {stage.status === 'active' && stage.key === 'translate' && stage.percent != null && (
                <div className="mt-1.5 w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-blue rounded-full transition-all duration-300"
                    style={{ width: `${stage.percent}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Log output */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <p className="text-white/40 text-xs mb-2 font-medium">Log</p>
        <div className="flex-1 overflow-y-auto bg-base rounded-lg border border-white/5 p-3 space-y-0.5">
          {logs.map((line, i) => (
            <p key={i} className="text-white/50 text-xs font-mono leading-5 break-all">
              <span className="text-primary/50 mr-2">›</span>
              {line}
            </p>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Error state */}
      {jobStatus === 'error' && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
            <p className="text-red-400 text-sm">{errorMsg}</p>
          </div>
          <button onClick={onBack} className="btn-secondary w-full">
            Go Back & Try Again
          </button>
        </div>
      )}
    </div>
  )
}
