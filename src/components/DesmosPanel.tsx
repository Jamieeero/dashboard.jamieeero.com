import { useEffect, useRef } from 'react'
import FullscreenButton from './FullscreenButton'

// Get a free API key at https://www.desmos.com/api (dev keys work fine
// for a personal, non-commercial dashboard).
const DESMOS_API_KEY = 'ff86c126e11f4b308536aab80d1851af'
const DESMOS_SCRIPT_SRC = `https://www.desmos.com/api/v1.9/calculator.js?apiKey=${DESMOS_API_KEY}`

declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator: (
        el: HTMLElement,
        options?: Record<string, unknown>
      ) => { setExpression: (expr: { latex: string }) => void; destroy: () => void; resize: () => void }
    }
  }
}

function loadDesmosScript(): Promise<void> {
  if (window.Desmos) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${DESMOS_SCRIPT_SRC}"]`
    )
    if (existing) {
      existing.addEventListener('load', () => resolve())
      return
    }
    const script = document.createElement('script')
    script.src = DESMOS_SCRIPT_SRC
    script.onload = () => resolve()
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export default function DesmosPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let calculator: ReturnType<NonNullable<Window['Desmos']>['GraphingCalculator']> | null =
      null
    let cancelled = false

    loadDesmosScript().then(() => {
      if (cancelled || !containerRef.current || !window.Desmos) return
      calculator = window.Desmos.GraphingCalculator(containerRef.current, {
        keypad: false,
        settingsMenu: false,
        expressionsCollapsed: true,
      })
    })

    return () => {
      cancelled = true
      calculator?.destroy()
    }
  }, [])

  useEffect(() => {
    // Desmos needs an explicit resize when its container's size changes
    // outside of a window resize event — e.g. entering/exiting fullscreen.
    const onFullscreenChange = () => {
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  return (
    <section className="panel panel--desmos" ref={panelRef}>
      <header className="panel__header">
        <h2>Desmos</h2>
        <div className="panel__header-actions">
          <span className="meta">graphing</span>
          <FullscreenButton targetRef={panelRef} />
        </div>
      </header>
      <div className="panel__body" ref={containerRef} />
    </section>
  )
}
