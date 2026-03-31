import React, { useRef, useEffect, useState } from 'react'

interface VideoPlayerProps {
  videoUrl: string
  vttContent: string
}

export default function VideoPlayer({ videoUrl, vttContent }: VideoPlayerProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [vttBlobUrl, setVttBlobUrl] = useState<string>('')

  // Create a blob URL for the VTT content so the video track can load it
  useEffect(() => {
    if (!vttContent) return

    const blob = new Blob([vttContent], { type: 'text/vtt' })
    const url = URL.createObjectURL(blob)
    setVttBlobUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [vttContent])

  return (
    <div className="flex flex-col h-full bg-black">
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        className="w-full flex-1 object-contain"
        style={{ maxHeight: 'calc(100% - 0px)' }}
      >
        {vttBlobUrl && (
          <track
            kind="subtitles"
            src={vttBlobUrl}
            srcLang="translated"
            label="Translated"
            default
          />
        )}
      </video>
    </div>
  )
}
