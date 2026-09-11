import { useEffect, useState, type RefObject } from 'react'

interface FullscreenButtonProps {
  targetRef: RefObject<HTMLElement>
}

export default function FullscreenButton({ targetRef }: FullscreenButtonProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === targetRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [targetRef])

  function toggle() {
    if (!targetRef.current) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      targetRef.current.requestFullscreen()
    }
  }

  return (
    <button
      className="fullscreen-btn"
      onClick={toggle}
      aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
    >
      {isFullscreen ? (
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
          <path
            d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
          <path
            d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  )
}
