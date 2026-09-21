import { useEffect, useMemo, useState } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface Entry {
  id: string
  name: string
  latex: string
  notes?: string // plain text; wrap inline math in $...$
  onSheet: boolean
}

interface Section {
  id: string
  name: string
  entries: Entry[]
}

type Mode = 'view' | 'edit'

const STORAGE_KEY = 'jamieeero-dashboard-physics1-crib-v2'

const t = String.raw

// [name, latex, notes]
type Seed = [string, string, string?]

// Starter set for a typical first Physics 1 exam (vectors -> kinematics -> Newton's laws).
// Trim or extend to match the actual syllabus.
const SEED: { name: string; entries: Seed[] }[] = [
  {
    name: 'Constants & Units',
    entries: [
      ['Gravity', t`g = 9.80\ \text{m/s}^2`, 'use 9.8 or 10 per instructor'],
      [
        'Conversions',
        t`1\ \text{mi} = 1609\ \text{m},\quad 1\ \text{mi/h} = 0.447\ \text{m/s},\quad 1\ \text{m/s} = 3.6\ \text{km/h}`,
      ],
      ['Trig identity', t`\sin^2\theta + \cos^2\theta = 1`],
      ['SI prefixes', t`\text{n}=10^{-9},\ \mu=10^{-6},\ \text{m}=10^{-3},\ \text{c}=10^{-2},\ \text{k}=10^{3},\ \text{M}=10^{6},\ \text{G}=10^{9}`],
      ['Length / time', t`1\ \text{in} = 2.54\ \text{cm},\quad 1\ \text{ft} = 0.3048\ \text{m},\quad 1\ \text{h} = 3600\ \text{s},\quad 1\ \text{rev} = 2\pi\ \text{rad}`],
      ['Squared / cubed units', t`1\ \text{cm}^2 = 10^{-4}\ \text{m}^2,\quad 1\ \text{cm}^3 = 10^{-6}\ \text{m}^3`, 'square/cube the prefix too'],
      ['Dimensions', t`[v]=\tfrac{L}{T},\ [a]=\tfrac{L}{T^2},\ [F]=\tfrac{ML}{T^2},\ [E]=\tfrac{ML^2}{T^2}`, 'use to check any formula'],
      ['Sig figs', t`\times\div:\ \text{fewest sig figs};\quad +-:\ \text{fewest decimal places}`, 'round only at the end'],
    ],
  },
  {
    name: 'Vectors',
    entries: [
      ['Components', t`A_x = A\cos\theta,\quad A_y = A\sin\theta`, t`$\theta$ measured from $+x$ axis`],
      ['Magnitude', t`A = \sqrt{A_x^2 + A_y^2}`],
      ['Direction', t`\theta = \tan^{-1}\!\left(\frac{A_y}{A_x}\right)`, 'check the quadrant'],
      ['Vector sum', t`R_x = A_x + B_x,\quad R_y = A_y + B_y`, 'add components, never magnitudes'],
    ],
  },
  {
    name: '1D Kinematics',
    entries: [
      ['Average velocity', t`v_{\text{avg}} = \frac{\Delta x}{\Delta t}`],
      ['Average acceleration', t`a_{\text{avg}} = \frac{\Delta v}{\Delta t}`],
      ['Velocity', t`v = v_0 + at`, 'constant $a$ only'],
      ['Position', t`x = x_0 + v_0 t + \tfrac{1}{2}at^2`, 'constant $a$ only'],
      ['Without t', t`v^2 = v_0^2 + 2a(x - x_0)`, 'constant $a$ only'],
      ['Without a', t`x - x_0 = \tfrac{1}{2}(v_0 + v)\,t`, 'constant $a$ only'],
      ['Free fall', t`a = -g = -9.8\ \text{m/s}^2`, '+y up; same going up and down'],
      ['Calculus form', t`v = \frac{dx}{dt},\quad a = \frac{dv}{dt},\quad \Delta x = \int v\,dt`, 'use when $a$ varies'],
    ],
  },
  {
    name: 'Projectiles & 2D',
    entries: [
      ['Launch components', t`v_{0x} = v_0\cos\theta_0,\quad v_{0y} = v_0\sin\theta_0`],
      ['Horizontal', t`x = x_0 + v_{0x}t`, '$a_x = 0$, $v_x$ constant'],
      ['Vertical', t`y = y_0 + v_{0y}t - \tfrac{1}{2}gt^2`, '$a_y = -g$'],
      ['Vertical velocity', t`v_y = v_{0y} - gt,\quad v_y^2 = v_{0y}^2 - 2g(y - y_0)`],
      ['Time of flight', t`T = \frac{2v_0\sin\theta_0}{g}`, 'lands at launch height'],
      ['Max height', t`H = \frac{v_0^2\sin^2\theta_0}{2g}`],
      ['Range', t`R = \frac{v_0^2\sin 2\theta_0}{g}`, t`level ground; max at $45^\circ$`],
      ['Relative velocity', t`\vec v_{AC} = \vec v_{AB} + \vec v_{BC}`, 'A rel. C = A rel. B + B rel. C'],
    ],
  },
  {
    name: "Newton's Laws",
    entries: [
      ['Second law', t`\sum F_x = ma_x,\quad \sum F_y = ma_y`, 'draw a free-body diagram first'],
      ['Equilibrium', t`\sum \vec F = 0`, '$a = 0$: at rest or constant $v$'],
      ['Weight', t`W = mg`, 'always straight down'],
      ['Third law', t`\vec F_{AB} = -\vec F_{BA}`, 'equal and opposite, on different objects'],
      ['Incline', t`F_\parallel = mg\sin\theta,\quad N = mg\cos\theta`, t`$\theta$ = incline angle`],
      [
        'Atwood machine',
        t`a = \frac{(m_2 - m_1)g}{m_1 + m_2},\quad T = \frac{2m_1 m_2 g}{m_1 + m_2}`,
        'ideal pulley, $m_2 > m_1$',
      ],
      ['Apparent weight', t`N = m(g + a)`, '$a$ positive upward (elevator)'],
    ],
  },
  {
    name: 'Friction',
    entries: [
      ['Static', t`f_s \le \mu_s N`, t`max just before slipping: $f_s = \mu_s N$`],
      ['Kinetic', t`f_k = \mu_k N`, t`opposes motion; usually $\mu_k < \mu_s$`],
      ['Slipping on incline', t`\tan\theta = \mu_s`, 'angle where block just starts to slide'],
      ['Sliding down incline', t`a = g(\sin\theta - \mu_k\cos\theta)`],

    ],
  },
  {
    name: 'Complex Systems',
    entries: [
      ['Approach', t`\text{FBD per object, own axes}\ \to\ \text{same } |a| \text{ for taut rope}\ \to\ \text{solve}`, 'ideal rope/pulley: same $T$'],
      ['Whole system', t`a = \frac{F_{\text{ext,net}}}{\sum m}`, 'internal forces (T, contact) cancel'],
      ['Push two blocks', t`F_{12} = \frac{m_2}{m_1+m_2}F`, 'contact force on $m_2$, frictionless'],
      ['Table + hanging', t`a = \frac{m_2 g - \mu_k m_1 g}{m_1+m_2}`, '$\mu_k = 0$ if frictionless'],
      ['Incline + hanging', t`a = \frac{m_2 g - m_1 g(\sin\theta + \mu_k\cos\theta)}{m_1+m_2}`, '$m_1$ moving up incline'],
      ['Stacked blocks', t`f_s \le \mu_s N,\quad a_{\max} = \mu_s g`, 'friction accelerates the top block'],
      ['Pulley constraint', t`\text{string length fixed} \Rightarrow \sum \Delta(\text{segments}) = 0`, 'movable pulley: $a_1 = 2a_2$'],
    ],
  },
  {
    name: 'Circular Motion',
    entries: [
      ['Centripetal accel.', t`a_c = \frac{v^2}{r} = \omega^2 r`, 'points toward the center'],
      ['Net radial force', t`\sum F_r = \frac{mv^2}{r}`, 'not a new force; the net inward force'],
      ['Speed & period', t`v = \frac{2\pi r}{T} = \omega r,\quad \omega = \frac{2\pi}{T}`],
      ['Banked curve', t`\tan\theta = \frac{v^2}{rg}`, 'frictionless'],
    ],
  },
  {
    name: 'Work & Kinetic Energy',
    entries: [
      ['Work (constant F)', t`W = \vec F\cdot\vec d = Fd\cos\phi`, '$\phi$ = angle between $F$ and $d$; sign matters'],
      ['Work (variable F)', t`W = \int_{x_i}^{x_f} F(x)\,dx`, 'area under $F$–$x$ graph'],
      ['Kinetic energy', t`K = \tfrac12 mv^2`],
      ['Work–energy theorem', t`W_{\text{net}} = \Delta K = \tfrac12 mv_f^2 - \tfrac12 mv_i^2`, 'use when $t$ not asked or $F$ varies'],
      ['Gravity', t`W_g = -mg(y_f - y_i)`, 'positive going down'],
      ['Spring', t`W_s = \tfrac12 kx_i^2 - \tfrac12 kx_f^2`],
      ['Friction', t`W_f = -f_k d`],
      ['Zero work', t`N \perp d,\quad F_c \perp v \Rightarrow W = 0`, 'normal force, centripetal force'],
      ['Power', t`P_{\text{avg}} = \frac{W}{\Delta t},\quad P = \vec F\cdot\vec v`, '1 W = 1 J/s; 1 hp = 746 W'],
      ['Units', t`1\ \text{J} = 1\ \text{N·m} = 1\ \text{kg·m}^2/\text{s}^2`],
      ['Frictionless drop', t`v = \sqrt{2gh}`, 'from rest, height $h$'],
      ['Setup cues', t`\text{starts/ends at rest} \Rightarrow K = 0`, '"stops" $\to K_f = 0$; "released" $\to K_i = 0$'],
    ],
  },
]

function buildSeed(): Section[] {
  return SEED.map((s) => ({
    id: crypto.randomUUID(),
    name: s.name,
    entries: s.entries.map(([name, latex, notes]) => ({
      id: crypto.randomUUID(),
      name,
      latex,
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

function Tex({ src }: { src: string }) {
  const html = useMemo(
    () => katex.renderToString(src, { throwOnError: false, strict: 'ignore' }),
    [src]
  )
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

// Plain text with inline $...$ math.
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/\$([^$]+)\$/g).map((part, i) => (i % 2 ? <Tex key={i} src={part} /> : part))}
    </>
  )
}

export default function Physics1CribSheet() {
  const [sections, setSections] = useState<Section[]>(() => loadSections())
  const [mode, setMode] = useState<Mode>('view')
  const [fontPt, setFontPt] = useState(8)
  const [cols, setCols] = useState(3)
  const [focusId, setFocusId] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sections))
  }, [sections])

  const total = sections.reduce((n, s) => n + s.entries.length, 0)
  const onSheet = sections.reduce((n, s) => n + s.entries.filter((e) => e.onSheet).length, 0)

  function changeMode(m: Mode) {
    setFocusId(null)
    setMode(m)
  }

  function addSection() {
    const id = crypto.randomUUID()
    setFocusId(id)
    setSections((prev) => [...prev, { id, name: '', entries: [] }])
  }

  function renameSection(id: string, name: string) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
  }

  function removeSection(s: Section) {
    if (s.entries.length && !window.confirm(`Remove "${s.name}" and its ${s.entries.length} formulas?`)) return
    setSections((prev) => prev.filter((x) => x.id !== s.id))
  }

  function updateEntries(sectionId: string, fn: (entries: Entry[]) => Entry[]) {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, entries: fn(s.entries) } : s)))
  }

  function addEntry(sectionId: string) {
    const id = crypto.randomUUID()
    setFocusId(id)
    updateEntries(sectionId, (es) => [...es, { id, name: '', latex: '', onSheet: true }])
  }

  function patchEntry(sectionId: string, entryId: string, patch: Partial<Entry>) {
    updateEntries(sectionId, (es) => es.map((e) => (e.id === entryId ? { ...e, ...patch } : e)))
  }

  return (
    <section className="panel panel--crib">
      <header className="panel__header">
        <h2>Physics 1 · Exam 1 crib sheet</h2>
        <div className="panel__header-actions cribsheet__controls">
          {mode === 'view' ? (
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
            </>
          ) : (
            <button className="fullscreen-btn" onClick={addSection}>+ Section</button>
          )}
          <span className="cribsheet__count">{onSheet} / {total} on sheet</span>
          <div className="shell__nav cribsheet__mode" role="tablist" aria-label="Crib sheet mode">
            {(['view', 'edit'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                className={`shell__tab${mode === m ? ' shell__tab--active' : ''}`}
                onClick={() => changeMode(m)}
              >
                {m === 'view' ? 'View' : 'Edit'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="panel__body panel__body--padded formulas__body">
        {mode === 'view' ? (
          onSheet === 0 ? (
            <p className="notion-empty">Nothing on the sheet yet. Switch to Edit to add formulas.</p>
          ) : (
            <div className="cribsheet__page" style={{ fontSize: `${fontPt}pt`, columnCount: cols }}>
              {sections.map((s) => {
                const rows = s.entries.filter((e) => e.onSheet && e.latex.trim())
                if (!rows.length) return null
                return (
                  <div key={s.id} className="cribsheet__sec">
                    <h4>{s.name || 'Untitled'}</h4>
                    {rows.map((e) => (
                      <div key={e.id} className="cribsheet__row">
                        {e.name && <span className="cribsheet__row-name">{e.name}: </span>}
                        <Tex src={e.latex} />
                        {e.notes && (
                          <span className="cribsheet__row-note"> (<Rich text={e.notes} />)</span>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )
        ) : (
          <>
            <p className="cribsheet__hint">
              Formulas are LaTeX (KaTeX). Notes are plain text; put inline math between $…$. Untick a formula to keep it off the sheet.
            </p>
            <div className="cribsheet__sections">
              {sections.map((s) => (
                <div key={s.id} className="cribsheet__section">
                  <div className="formulas__detail-header">
                    <input
                      type="text"
                      className="cribsheet__field cribsheet__field--title"
                      placeholder="Section name"
                      value={s.name}
                      onChange={(e) => renameSection(s.id, e.target.value)}
                      autoFocus={s.id === focusId}
                      aria-label="Section name"
                    />
                    <div className="cribsheet__section-actions">
                      <button
                        className="fullscreen-btn"
                        onClick={() => addEntry(s.id)}
                        aria-label={`Add formula to ${s.name || 'section'}`}
                        title="Add formula"
                      >
                        +
                      </button>
                      <button
                        className="quicklinks__remove"
                        onClick={() => removeSection(s)}
                        aria-label={`Remove ${s.name || 'section'}`}
                        title="Remove section"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="formulas__list">
                    {s.entries.map((f) => (
                      <div
                        key={f.id}
                        className={`formulas__item cribsheet__item${f.onSheet ? '' : ' cribsheet__item--off'}`}
                      >
                        <input
                          type="checkbox"
                          checked={f.onSheet}
                          onChange={() => patchEntry(s.id, f.id, { onSheet: !f.onSheet })}
                          aria-label={`Include ${f.name || 'formula'} on sheet`}
                          title="Include on sheet"
                        />
                        <div className="formulas__item-main">
                          <input
                            type="text"
                            className="cribsheet__field cribsheet__field--name"
                            placeholder="Name"
                            value={f.name}
                            onChange={(e) => patchEntry(s.id, f.id, { name: e.target.value })}
                            autoFocus={f.id === focusId}
                          />
                          <input
                            type="text"
                            className="cribsheet__field cribsheet__field--tex"
                            placeholder="LaTeX, e.g. x = x_0 + v_0 t + \tfrac{1}{2}at^2"
                            value={f.latex}
                            onChange={(e) => patchEntry(s.id, f.id, { latex: e.target.value })}
                            spellCheck={false}
                          />
                          <div className="cribsheet__preview"><Tex src={f.latex} /></div>
                          <input
                            type="text"
                            className="cribsheet__field"
                            placeholder="Notes (optional)"
                            value={f.notes ?? ''}
                            onChange={(e) => patchEntry(s.id, f.id, { notes: e.target.value || undefined })}
                          />
                        </div>
                        <button
                          className="quicklinks__remove"
                          onClick={() => updateEntries(s.id, (es) => es.filter((x) => x.id !== f.id))}
                          aria-label={`Remove ${f.name || 'formula'}`}
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {s.entries.length === 0 && (
                      <p className="notion-empty">No formulas in this section yet.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
