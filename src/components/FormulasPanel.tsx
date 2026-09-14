import { useEffect, useState } from 'react'

interface Formula {
  id: string
  name: string
  expression: string
  notes?: string
}

interface Topic {
  id: string
  name: string
  formulas: Formula[]
}

const STORAGE_KEY = 'jamieeero-dashboard-formulas'

function loadTopics(): Topic[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export default function FormulasPanel() {
  const [topics, setTopics] = useState<Topic[]>(() => loadTopics())
  const [activeTopicId, setActiveTopicId] = useState<string | null>(
    () => loadTopics()[0]?.id ?? null
  )
  const [addingTopic, setAddingTopic] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')
  const [addingFormula, setAddingFormula] = useState(false)
  const [formulaName, setFormulaName] = useState('')
  const [formulaExpression, setFormulaExpression] = useState('')
  const [formulaNotes, setFormulaNotes] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(topics))
  }, [topics])

  const activeTopic = topics.find((t) => t.id === activeTopicId) ?? null

  function addTopic(e: React.FormEvent) {
    e.preventDefault()
    if (!newTopicName.trim()) return
    const topic: Topic = { id: crypto.randomUUID(), name: newTopicName.trim(), formulas: [] }
    setTopics((prev) => [...prev, topic])
    setActiveTopicId(topic.id)
    setNewTopicName('')
    setAddingTopic(false)
  }

  function removeTopic(id: string) {
    setTopics((prev) => prev.filter((t) => t.id !== id))
    if (activeTopicId === id) setActiveTopicId(null)
  }

  function addFormula(e: React.FormEvent) {
    e.preventDefault()
    if (!activeTopicId || !formulaName.trim() || !formulaExpression.trim()) return
    const formula: Formula = {
      id: crypto.randomUUID(),
      name: formulaName.trim(),
      expression: formulaExpression.trim(),
      notes: formulaNotes.trim() || undefined,
    }
    setTopics((prev) =>
      prev.map((t) => (t.id === activeTopicId ? { ...t, formulas: [...t.formulas, formula] } : t))
    )
    setFormulaName('')
    setFormulaExpression('')
    setFormulaNotes('')
    setAddingFormula(false)
  }

  function removeFormula(formulaId: string) {
    if (!activeTopicId) return
    setTopics((prev) =>
      prev.map((t) =>
        t.id === activeTopicId ? { ...t, formulas: t.formulas.filter((f) => f.id !== formulaId) } : t
      )
    )
  }

  return (
    <section className="panel panel--formulas">
      <header className="panel__header">
        <h2>Formulas</h2>
        <div className="panel__header-actions">
          <button
            className="fullscreen-btn"
            onClick={() => setAddingTopic((v) => !v)}
            aria-label={addingTopic ? 'Cancel' : 'Add topic'}
            title={addingTopic ? 'Cancel' : 'Add topic'}
          >
            {addingTopic ? '×' : '+ Topic'}
          </button>
        </div>
      </header>

      <div className="panel__body panel__body--padded formulas__body">
        {addingTopic && (
          <form className="quicklinks__form" onSubmit={addTopic}>
            <input
              type="text"
              placeholder="Topic name (e.g. Kinematics)"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              autoFocus
            />
            <button type="submit" className="quicklinks__add-submit">Add</button>
          </form>
        )}

        {topics.length === 0 && !addingTopic && (
          <p className="notion-empty">No topics yet. Add one to start building your formula repository.</p>
        )}

        {topics.length > 0 && (
          <div className="formulas__layout">
            <div className="formulas__topics">
              {topics.map((t) => (
                <div key={t.id} className="formulas__topic-row">
                  <button
                    className={`formulas__topic-btn${t.id === activeTopicId ? ' formulas__topic-btn--active' : ''}`}
                    onClick={() => setActiveTopicId(t.id)}
                  >
                    {t.name}
                    <span className="formulas__topic-count">{t.formulas.length}</span>
                  </button>
                  <button
                    className="quicklinks__remove"
                    onClick={() => removeTopic(t.id)}
                    aria-label={`Remove ${t.name}`}
                    title="Remove topic"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="formulas__detail">
              {activeTopic ? (
                <>
                  <div className="formulas__detail-header">
                    <h3>{activeTopic.name}</h3>
                    <button
                      className="fullscreen-btn"
                      onClick={() => setAddingFormula((v) => !v)}
                      aria-label={addingFormula ? 'Cancel' : 'Add formula'}
                      title={addingFormula ? 'Cancel' : 'Add formula'}
                    >
                      {addingFormula ? '×' : '+'}
                    </button>
                  </div>

                  {addingFormula && (
                    <form className="formulas__form" onSubmit={addFormula}>
                      <input
                        type="text"
                        placeholder="Name (e.g. Quadratic formula)"
                        value={formulaName}
                        onChange={(e) => setFormulaName(e.target.value)}
                        autoFocus
                      />
                      <input
                        type="text"
                        placeholder="Expression (e.g. x = (-b ± √(b²-4ac)) / 2a)"
                        value={formulaExpression}
                        onChange={(e) => setFormulaExpression(e.target.value)}
                        className="formulas__form-expression"
                      />
                      <input
                        type="text"
                        placeholder="Notes (optional)"
                        value={formulaNotes}
                        onChange={(e) => setFormulaNotes(e.target.value)}
                      />
                      <button type="submit" className="quicklinks__add-submit">Add</button>
                    </form>
                  )}

                  {activeTopic.formulas.length === 0 && !addingFormula && (
                    <p className="notion-empty">No formulas in this topic yet.</p>
                  )}

                  <div className="formulas__list">
                    {activeTopic.formulas.map((f) => (
                      <div key={f.id} className="formulas__item">
                        <div className="formulas__item-main">
                          <span className="formulas__item-name">{f.name}</span>
                          <code className="formulas__item-expression">{f.expression}</code>
                          {f.notes && <span className="formulas__item-notes">{f.notes}</span>}
                        </div>
                        <button
                          className="quicklinks__remove"
                          onClick={() => removeFormula(f.id)}
                          aria-label={`Remove ${f.name}`}
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="notion-empty">Select a topic on the left.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}