import { useEffect, useRef } from 'react'

// Get a free API key at https://www.desmos.com/api (dev keys work fine
// for a personal, non-commercial dashboard).
const DESMOS_API_KEY = 'YOUR_DESMOS_API_KEY'
const DESMOS_SCRIPT_SRC = `https://www.desmos.com/api/v1.9/calculator.js?apiKey=${DESMOS_API_KEY}`

declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator: (
        el: HTMLElement,
        options?: Record<string, unknown>
      ) => { setExpression: (expr: { latex: string }) => void; destroy: () => void }
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
      // Optionally seed a starting expression or load a saved graph state here:
      // calculator.setExpression({ latex: 'y=x^2' })
    })

    return () => {
      cancelled = true
      calculator?.destroy()
    }
  }, [])

  return (
    <section className="panel panel--desmos">
      <header className="panel__header">
        <h2>Desmos</h2>
        <span className="meta">graphing</span>
      </header>
      <div className="panel__body" ref={containerRef} />
    </section>
  )
}
