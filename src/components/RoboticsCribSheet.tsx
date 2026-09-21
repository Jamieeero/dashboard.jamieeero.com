// components/RoboticsCribSheet.tsx

import { useEffect, useMemo, useState } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface Entry {
  id: string
  name: string
  latex: string
  notes?: string
  onSheet: boolean
}

interface Section {
  id: string
  name: string
  entries: Entry[]
}

type Mode = 'view' | 'edit'

const STORAGE_KEY = 'jamieeero-dashboard-robotics-crib-v1'

const t = String.raw

type Seed = [string, string, string?]

const SEED: { name: string; entries: Seed[] }[] = [
  {
    name: 'Linear Algebra Basics',
    entries: [
      ['Transpose', t`(AB)^T = B^T A^T`, 'Swaps rows and columns'],
      ['Inverse', t`A A^{-1} = I, \quad (AB)^{-1} = B^{-1} A^{-1}`, 'Requires $det(A) \\neq 0$'],
      ['Determinant (2x2)', t`\det \begin{bmatrix} a & b \\ c & d \end{bmatrix} = ad - bc`, 'Non-zero means invertible matrix'],
      ['Row Reduction', t`[A \mid I] \xrightarrow{\text{RREF}} [I \mid A^{-1}]`, 'Reduces matrix to solve $Ax=b$ or find inverse'],
      ['Vector Projection', t`\text{proj}_{u}(v) = \left( \frac{v \cdot u}{u \cdot u} \right) u`, 'Projects vector $v$ onto vector $u$'],
    ],
  },
  {
    name: 'Vectors & Frames',
    entries: [
      ['Position Vector', t`^A P = \begin{bmatrix} p_x \\ p_y \\ p_z \end{bmatrix}`, 'Coordinates of point $P$ relative to frame ${A}$'],
      ['Dot Product', t`u \cdot v = u^T v = |u||v|\cos\theta`, 'Zero if vectors are orthogonal (perpendicular)'],
      ['Cross Product', t`u \times v = S(u)v`, 'Yields a vector orthogonal to both $u$ and $v$'],
      ['Skew-Symmetric', t`S(u) = \begin{bmatrix} 0 & -u_z & u_y \\ u_z & 0 & -u_x \\ -u_y & u_x & 0 \end{bmatrix}`, t`Matrix representation of cross product; $S^T = -S$`],
    ],
  },
  {
    name: 'Orientation & Rotations',
    entries: [
      ['2D Rotation', t`R(\theta) = \begin{bmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{bmatrix}`, 'Counterclockwise rotation by $\\theta$'],
      ['Rotation Properties', t`R^T R = I, \quad R^{-1} = R^T, \quad \det(R) = 1`, 'Orthogonal matrix properties'],
      ['Rot about Z (Yaw)', t`R_z(\theta) = \begin{bmatrix} c\theta & -s\theta & 0 \\ s\theta & c\theta & 0 \\ 0 & 0 & 1 \end{bmatrix}`, t`Shorthand: $c = \cos$, $s = \sin$`],
      ['Rot about Y (Pitch)', t`R_y(\theta) = \begin{bmatrix} c\theta & 0 & s\theta \\ 0 & 1 & 0 \\ -s\theta & 0 & c\theta \end{bmatrix}`],
      ['Rot about X (Roll)', t`R_x(\theta) = \begin{bmatrix} 1 & 0 & 0 \\ 0 & c\theta & -s\theta \\ 0 & s\theta & c\theta \end{bmatrix}`],
      ['Angle of Rotation', t`\theta = \cos^{-1}\left(\frac{\text{Tr}(R) - 1}{2}\right)`, 'Trace $Tr(R)$ is the sum of diagonal elements'],
    ],
  },
  {
    name: 'Transformations & Config',
    entries: [
      ['Relative Position', t`^A P = ^A P_B + {}^A_B R \, ^B P`, 'Mapping a point from ${B}$ to ${A}$'],
      ['Homogeneous Trans.', t`^A_B T = \begin{bmatrix} ^A_B R & ^A P_B \\ 0_{1\times3} & 1 \end{bmatrix}`, 'Combines rotation and translation in 4x4 matrix'],
      ['Inverse Transform', t`T^{-1} = \begin{bmatrix} R^T & -R^T P \\ 0 & 1 \end{bmatrix}`, 'Do NOT just transpose $T$ to find the inverse!'],
      ['Compound Transform', t`^A_C T = {}^A_B T \, {}^B_C T`, 'Multiply matrices right-to-left to chain frames'],
    ],
  },
  {
    name: 'Differential Kinematics',
    entries: [
      ['Forward Kinematics', t`\dot{x} = J(q)\dot{q}`, 'Maps joint velocities $\dot{q}$ to end-effector velocity $\dot{x}$'],
      ['Jacobian Matrix', t`J = \begin{bmatrix} J_v \\ J_{\omega} \end{bmatrix}`, 'Contains linear ($v$) and angular ($\omega$) velocity blocks'],
      ['Inverse Kinematics', t`\dot{q} = J^{-1} \dot{x}`, 'Requires square Jacobian; fails at singularities'],
      ['Singularities', t`\det(J) = 0`, 'Robot loses a degree of freedom (cannot move in a specific direction)'],
      ['Static Forces', t`\tau = J^T F`, 'Maps end-effector forces $F$ to joint torques $\tau$'],
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

function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/\$([^$]+)\$/g).map((part, i) => (i % 2 ? <Tex key={i} src={part} /> : part))}
    </>
  )
}

export default function RoboticsCribSheet() {
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
        <h2>Intro to Robotics · Crib Sheet</h2>
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
                            placeholder="LaTeX"
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