import { useEffect, useState } from 'react'

interface Entry {
  id: string
  name: string
  expression: string
  notes?: string
  onSheet: boolean
}

interface Section {
  id: string
  name: string
  entries: Entry[]
}

const STORAGE_KEY = 'jamieeero-dashboard-physics1-crib'

// [name, expression, notes]. Use _x or _{sub} for subscripts.
type Seed = [string, string, string?]

// Starter set for a typical first Physics 1 exam (vectors -> kinematics -> Newton's laws).
// Trim or extend to match the actual syllabus.
const SEED: { name: string; entries: Seed[] }[] = [
  {
    name: 'Constants & Units',
    entries: [
      ['Gravity', 'g = 9.80 m/s²', 'use 9.8 or 10 per instructor'],
      ['Conversions', '1 mi = 1609 m,  1 mi/h = 0.447 m/s,  1 m/s = 3.6 km/h'],
      ['Trig identity', 'sin²θ + cos²θ = 1'],
    ],
  },
  {
    name: 'Vectors',
    entries: [
      ['Components', 'A_x = A cos θ,  A_y = A sin θ', 'θ measured from +x axis'],
      ['Magnitude', 'A = √(A_x² + A_y²)'],
      ['Direction', 'θ = tan⁻¹(A_y / A_x)', 'check the quadrant'],
      ['Vector sum', 'R_x = A_x + B_x,  R_y = A_y + B_y', 'add components, never magnitudes'],
    ],
  },
  {
    name: '1D Kinematics',
    entries: [
      ['Average velocity', 'v_{avg} = Δx / Δt'],
      ['Average acceleration', 'a_{avg} = Δv / Δt'],
      ['Velocity', 'v = v₀ + at', 'constant a only'],
      ['Position', 'x = x₀ + v₀t + ½at²', 'constant a only'],
      ['No time', 'v² = v₀² + 2a(x − x₀)', 'constant a only'],
      ['No acceleration', 'x − x₀ = ½(v₀ + v)t', 'constant a only'],
      ['Free fall', 'a = −g = −9.8 m/s²', '+y up; same going up and down'],
      ['Calculus form', 'v = dx/dt,  a = dv/dt,  Δx = ∫v dt', 'use when a varies'],
    ],
  },
  {
    name: 'Projectiles & 2D',
    entries: [
      ['Launch components', 'v₀_x = v₀ cos θ₀,  v₀_y = v₀ sin θ₀'],
      ['Horizontal', 'x = x₀ + v₀_x t', 'a_x = 0, v_x constant'],
      ['Vertical', 'y = y₀ + v₀_y t − ½gt²', 'a_y = −g'],
      ['Vertical velocity', 'v_y = v₀_y − gt,  v_y² = v₀_y² − 2g(y − y₀)'],
      ['Time of flight', 'T = 2v₀ sin θ₀ / g', 'lands at launch height'],
      ['Max height', 'H = v₀² sin²θ₀ / 2g'],
      ['Range', 'R = v₀² sin 2θ₀ / g', 'level ground; max at 45°'],
      ['Relative velocity', 'v_{AC} = v_{AB} + v_{BC}', 'A rel. C = A rel. B + B rel. C'],
    ],
  },
  {
    name: "Newton's Laws",
    entries: [
      ['Second law', 'ΣF_x = ma_x,  ΣF_y = ma_y', 'draw a free-body diagram first'],
      ['Equilibrium', 'ΣF = 0', 'a = 0: at rest or constant v'],
      ['Weight', 'W = mg', 'always straight down'],
      ['Third law', 'F_{AB} = −F_{BA}', 'equal and opposite, on different objects'],
      ['Incline', 'along: mg sin θ,  ⊥: N = mg cos θ', 'θ = incline angle'],
      ['Atwood machine', 'a = (m₂ − m₁)g / (m₁ + m₂),  T = 2m₁m₂g / (m₁ + m₂)', 'ideal pulley, m₂ > m₁'],
      ['Apparent weight', 'N = m(g + a)', 'a positive upward (elevator)'],
    ],
  },
  {
    name: 'Friction',
    entries: [
      ['Static', 'f_s ≤ μ_s N', 'max just before slipping: f_s = μ_s N'],
      ['Kinetic', 'f_k = μ_k N', 'opposes motion; usually μ_k < μ_s'],
      ['Slipping on incline', 'tan θ = μ_s', 'angle where block just starts to slide'],
      ['Sliding down incline', 'a = g(sin θ − μ_k cos θ)'],
    ],
  },
  {
    name: 'Circular Motion',
    entries: [
      ['Centripetal accel.', 'a_c = v² / r = ω²r', 'points toward the center'],
      ['Net radial force', 'ΣF_r = mv² / r', 'not a new force; the net inward force'],
      ['Speed & period', 'v = 2πr / T = ωr,  ω = 2π / T'],
      ['Banked curve', 'tan θ = v² / rg', 'frictionless'],
    ],
  },
]

function buildSeed(): Section[] {
  return SEED.map((s) => ({
    id: crypto.randomUUID(),
    name: s.name,
    entries: s.entries.map(([name, expression, notes]) => ({
      id: crypto.randomUUID(),
      name,
      expression,
      notes,
      onSheet: true,
    })),
  }))
}

function loadSections(): Section[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : buildSeed()
  } catch {
    return buildSeed()
  }
}

// Renders _x / _{avg} as subscripts.
function Expr({ text }: { text: string }) {
  const parts = text.split(/(_\{[^}]+\}|_[A-Za-z0-9])/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('_') ? <sub key={i}>{p.replace(/[_{}]/g, '')}</sub> : p
      )}
    </>
  )
}

export default function Physics1CribSheet() {
  const [sections, setSections] = useState<Section[]>(() => loadSections())
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [fontPt, setFontPt] = useState(8)
  const [cols, setCols] = useState(3)
  const [addingSection, setAddingSection] = useState(false)
  const [sectionName, setSectionName] = useState('')
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [expression, setExpression] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sections))
  }, [sections])

  const total = sections.reduce((n, s) => n + s.entries.length, 0)
  const onSheet = sections.reduce((n, s) => n + s.entries.filter((e) => e.onSheet).length, 0)

  function addSection(e: React.FormEvent) {
    e.preventDefault()
    if (!sectionName.trim()) return
    setSections((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: sectionName.trim(), entries: [] },
    ])
    setSectionName('')
    setAddingSection(false)
  }

  function removeSection(s: Section) {
    if (s.entries.length && !window.confirm(`Remove "${s.name}" and its ${s.entries.length} formulas?`)) return
    setSections((prev) => prev.filter((x) => x.id !== s.id))
  }

  function addEntry(e: React.FormEvent, sectionId: string) {
    e.preventDefault()
    if (!name.trim() || !expression.trim()) return
    const entry: Entry = {
      id: crypto.randomUUID(),
      name: name.trim(),
      expression: expression.trim(),
      notes: notes.trim() || undefined,
      onSheet: true,
    }
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, entries: [...s.entries, entry] } : s))
    )
    setName('')
    setExpression('')
    setNotes('')
    setAddingTo(null)
  }

  function updateEntries(sectionId: string, fn: (entries: Entry[]) => Entry[]) {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, entries: fn(s.entries) } : s)))
  }

  return (
    <section className="panel panel--crib">
      <header className="panel__header">
        <h2>Physics 1 · Exam 1 crib sheet</h2>
        <div className="panel__header-actions cribsheet__controls">
          <span className="cribsheet__count">{onSheet} / {total} on sheet</span>
          {mode === 'edit' ? (
            <>
              <button className="fullscreen-btn" onClick={() => setAddingSection((v) => !v)}>
                {addingSection ? '×' : '+ Section'}
              </button>
              <button className="fullscreen-btn" onClick={() => setMode('preview')}>Preview</button>
            </>
          ) : (
            <>
              <label className="cribsheet__ctl">
                font
                <input type="range" min={6} max={12} step={0.5} value={fontPt} onChange={(e) => setFontPt(Number(e.target.value))} />
                {fontPt}pt
              </label>
              <label className="cribsheet__ctl">
                cols
                <input type="range" min={1} max={4} step={1} value={cols} onChange={(e) => setCols(Number(e.target.value))} />
                {cols}
              </label>
              <button className="fullscreen-btn" onClick={() => window.print()}>Print</button>
              <button className="fullscreen-btn" onClick={() => setMode('edit')}>Edit</button>
            </>
          )}
        </div>
      </header>

      <div className="panel__body panel__body--padded formulas__body">
        {mode === 'edit' && addingSection && (
          <form className="quicklinks__form" onSubmit={addSection}>
            <input
              type="text"
              placeholder="Section name (e.g. Work & Energy)"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              autoFocus
            />
            <button type="submit" className="quicklinks__add-submit">Add</button>
          </form>
        )}

        {mode === 'edit' ? (
          <div className="cribsheet__sections">
            {sections.map((s) => (
              <div key={s.id} className="cribsheet__section">
                <div className="formulas__detail-header">
                  <h3>{s.name}</h3>
                  <div className="cribsheet__section-actions">
                    <button
                      className="fullscreen-btn"
                      onClick={() => setAddingTo(addingTo === s.id ? null : s.id)}
                      aria-label={addingTo === s.id ? 'Cancel' : `Add formula to ${s.name}`}
                      title={addingTo === s.id ? 'Cancel' : 'Add formula'}
                    >
                      {addingTo === s.id ? '×' : '+'}
                    </button>
                    <button
                      className="quicklinks__remove"
                      onClick={() => removeSection(s)}
                      aria-label={`Remove ${s.name}`}
                      title="Remove section"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {addingTo === s.id && (
                  <form className="formulas__form" onSubmit={(e) => addEntry(e, s.id)}>
                    <input
                      type="text"
                      placeholder="Name (e.g. Work-energy theorem)"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                    />
                    <input
                      type="text"
                      placeholder="Expression (subscripts: _x or _{avg})"
                      value={expression}
                      onChange={(e) => setExpression(e.target.value)}
                      className="formulas__form-expression"
                    />
                    <input
                      type="text"
                      placeholder="Notes / conditions (optional)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                    <button type="submit" className="quicklinks__add-submit">Add</button>
                  </form>
                )}

                <div className="formulas__list">
                  {s.entries.map((f) => (
                    <div
                      key={f.id}
                      className={`formulas__item cribsheet__item${f.onSheet ? '' : ' cribsheet__item--off'}`}
                    >
                      <input
                        type="checkbox"
                        checked={f.onSheet}
                        onChange={() =>
                          updateEntries(s.id, (es) => es.map((x) => (x.id === f.id ? { ...x, onSheet: !x.onSheet } : x)))
                        }
                        aria-label={`Include ${f.name} on sheet`}
                        title="Include on sheet"
                      />
                      <div className="formulas__item-main">
                        <span className="formulas__item-name">{f.name}</span>
                        <code className="formulas__item-expression"><Expr text={f.expression} /></code>
                        {f.notes && <span className="formulas__item-notes"><Expr text={f.notes} /></span>}
                      </div>
                      <button
                        className="quicklinks__remove"
                        onClick={() => updateEntries(s.id, (es) => es.filter((x) => x.id !== f.id))}
                        aria-label={`Remove ${f.name}`}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {s.entries.length === 0 && addingTo !== s.id && (
                    <p className="notion-empty">No formulas in this section yet.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="cribsheet__page" style={{ fontSize: `${fontPt}pt`, columnCount: cols }}>
            {sections.map((s) => {
              const rows = s.entries.filter((e) => e.onSheet)
              if (!rows.length) return null
              return (
                <div key={s.id} className="cribsheet__sec">
                  <h4>{s.name}</h4>
                  {rows.map((e) => (
                    <div key={e.id} className="cribsheet__row">
                      <span className="cribsheet__row-name">{e.name}:</span>{' '}
                      <code><Expr text={e.expression} /></code>
                      {e.notes && <span className="cribsheet__row-note"> (<Expr text={e.notes} />)</span>}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
