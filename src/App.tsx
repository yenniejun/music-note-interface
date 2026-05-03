import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import './App.css'
import type { ActiveState, IntervalNode, Ratio } from './types'
import {
  formatHz,
  noteNameFromFreq,
  octaveBound,
  parseNoteName,
  power,
  ratioValue,
  reduce,
} from './music'
import { cancelAll, playBaseTone, playSequence, playSingleNode } from './audio'
import { NodeCard } from './NodeCard'

function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: React.ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      else if (e.key === 'Enter') onConfirm()
    }
    document.addEventListener('keydown', handler)
    confirmRef.current?.focus()
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel, onConfirm])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-title" className="modal-title">{title}</h2>
        <div className="modal-body">{message}</div>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            ref={confirmRef}
            className="btn-primary btn-confirm-danger"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <span className="info-tip" tabIndex={0} role="img" aria-label="info">
      <span aria-hidden="true">ⓘ</span>
      <span className="info-tip-bubble">{children}</span>
    </span>
  )
}

const MIDDLE_C = 261.63

function newId() {
  return Math.random().toString(36).slice(2, 10)
}

function makeNode(ratio: Ratio): IntervalNode {
  return {
    id: newId(),
    ratio,
    playMode: 'together',
    direction: 'ascending',
  }
}

const STARTER: IntervalNode[] = [makeNode({ upper: 3, lower: 2 })]

export default function App() {
  const [nodes, setNodes] = useState<IntervalNode[]>(STARTER)
  const [basePitch, setBasePitch] = useState<number>(MIDDLE_C)
  const [basePitchInput, setBasePitchInput] = useState<string>('261.63')
  const [bounded, setBounded] = useState(false)
  const [active, setActive] = useState<ActiveState>(null)
  const [seqPlaying, setSeqPlaying] = useState(false)
  const [basePlaying, setBasePlaying] = useState(false)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)

  const [addUpper, setAddUpper] = useState('5')
  const [addLower, setAddLower] = useState('4')

  const [powUpper, setPowUpper] = useState('3')
  const [powLower, setPowLower] = useState('2')
  const [powFrom, setPowFrom] = useState('-1')
  const [powTo, setPowTo] = useState('5')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const lastBasePitch = useRef(basePitch)
  lastBasePitch.current = basePitch

  const handleBaseChange = (val: string) => {
    setBasePitchInput(val)
    const trimmed = val.trim()
    const asNum = Number(trimmed)
    if (!Number.isNaN(asNum) && asNum > 0) {
      setBasePitch(asNum)
      return
    }
    const fromName = parseNoteName(trimmed)
    if (fromName) setBasePitch(fromName)
  }

  const baseNote = noteNameFromFreq(basePitch)
  const baseNoteLabel = (() => {
    const c = Math.round(baseNote.centsOffset)
    if (Math.abs(baseNote.centsOffset) < 0.5) return `${baseNote.name}${baseNote.octave}`
    return `≈ ${baseNote.name}${baseNote.octave} ${c > 0 ? '+' : ''}${c}¢`
  })()

  const playOne = (node: IntervalNode) => {
    cancelAll(setActive)
    setSeqPlaying(false)
    playSingleNode(node, basePitch, bounded, setActive)
  }

  const playAll = () => {
    if (nodes.length === 0) return
    cancelAll(setActive)
    setSeqPlaying(true)
    playSequence(nodes, basePitch, bounded, setActive, () => setSeqPlaying(false))
  }

  const stop = () => {
    cancelAll(setActive, setSeqPlaying)
    setBasePlaying(false)
  }

  const playBase = () => {
    cancelAll(setActive)
    setSeqPlaying(false)
    playBaseTone(basePitch, setBasePlaying)
  }

  const requestClearAll = () => {
    if (nodes.length === 0) return
    setConfirmClearOpen(true)
  }

  const performClearAll = () => {
    cancelAll(setActive, setSeqPlaying)
    setNodes([])
    setConfirmClearOpen(false)
  }

  const addNode = () => {
    const u = parseInt(addUpper, 10)
    const l = parseInt(addLower, 10)
    if (!Number.isFinite(u) || !Number.isFinite(l) || l <= 0 || u <= 0) return
    const r = reduce(u, l)
    setNodes((ns) => [...ns, makeNode(r)])
  }

  const deleteNode = (id: string) =>
    setNodes((ns) => ns.filter((n) => n.id !== id))

  const updateNode = (id: string, patch: Partial<IntervalNode>) =>
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)))

  const sortNodes = (dir: 'asc' | 'desc') => {
    setNodes((ns) =>
      [...ns].sort((a, b) => {
        const av = ratioValue(bounded ? octaveBound(a.ratio) : a.ratio)
        const bv = ratioValue(bounded ? octaveBound(b.ratio) : b.ratio)
        return dir === 'asc' ? av - bv : bv - av
      }),
    )
  }

  const generatePower = () => {
    const u = parseInt(powUpper, 10)
    const l = parseInt(powLower, 10)
    const from = parseInt(powFrom, 10)
    const to = parseInt(powTo, 10)
    if (!Number.isFinite(u) || !Number.isFinite(l) || l <= 0 || u <= 0) return
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return
    const base: Ratio = reduce(u, l)
    const generated: IntervalNode[] = []
    for (let n = from; n <= to; n++) {
      try {
        const r = power(base, n)
        if (r.upper > 1e9 || r.lower > 1e9) continue
        generated.push(makeNode(r))
      } catch {
        // skip
      }
    }
    setNodes((ns) => [...ns, ...generated])
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active: a, over } = e
    if (!over || a.id === over.id) return
    setNodes((ns) => {
      const oldIndex = ns.findIndex((n) => n.id === a.id)
      const newIndex = ns.findIndex((n) => n.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return ns
      return arrayMove(ns, oldIndex, newIndex)
    })
  }

  const ids = useMemo(() => nodes.map((n) => n.id), [nodes])

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="title">Interval Explorer</h1>
          <p className="subtitle">composing scales from just-intonation ratios</p>
        </div>
        <div className="hint">base · {baseNote.name}{baseNote.octave} · {formatHz(basePitch)} Hz</div>
      </header>

      <div className="panels">
        <section className="panel">
          <h3>add a node</h3>
          <div className="add-form">
            <input
              type="number"
              min={1}
              value={addUpper}
              onChange={(e) => setAddUpper(e.target.value)}
              aria-label="upper integer"
            />
            <span className="hint">:</span>
            <input
              type="number"
              min={1}
              value={addLower}
              onChange={(e) => setAddLower(e.target.value)}
              aria-label="lower integer"
            />
            <button onClick={addNode}>add</button>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>
            ratio is upper:lower. lower anchors to the base pitch.
          </p>
        </section>

        <section className="panel">
          <h3>power sequence generator</h3>
          <div className="power-row">
            <span>base</span>
            <input
              type="number"
              min={1}
              value={powUpper}
              onChange={(e) => setPowUpper(e.target.value)}
              aria-label="power base upper"
            />
            <span className="hint">:</span>
            <input
              type="number"
              min={1}
              value={powLower}
              onChange={(e) => setPowLower(e.target.value)}
              aria-label="power base lower"
            />
            <span style={{ marginLeft: 8 }}>from</span>
            <input
              type="number"
              value={powFrom}
              onChange={(e) => setPowFrom(e.target.value)}
              aria-label="from exponent"
            />
            <span>to</span>
            <input
              type="number"
              value={powTo}
              onChange={(e) => setPowTo(e.target.value)}
              aria-label="to exponent"
            />
            <button onClick={generatePower}>generate</button>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>
            adds one node per integer exponent.
          </p>
        </section>
      </div>

      <div className="toolbar">
        <div className="toolbar-group">
          <button className="btn-primary" onClick={playAll} disabled={nodes.length === 0 || seqPlaying}>
            ▶ play sequence
          </button>
          {(seqPlaying || active) && (
            <button onClick={stop}>■ stop</button>
          )}
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button className="btn-ghost" onClick={() => sortNodes('asc')} disabled={nodes.length < 2}>
            sort ↑
          </button>
          <button className="btn-ghost" onClick={() => sortNodes('desc')} disabled={nodes.length < 2}>
            sort ↓
          </button>
        </div>

        <div className="toolbar-divider" />

        <button
          className="btn-ghost btn-danger"
          onClick={requestClearAll}
          disabled={nodes.length === 0}
          title="remove all nodes"
        >
          clear all
        </button>

        <div className="toolbar-divider" />

        <label className="toggle">
          <input
            type="checkbox"
            checked={bounded}
            onChange={(e) => setBounded(e.target.checked)}
          />
          bound to one octave
          <InfoTip>
            Folds every ratio into the range <strong>1 ≤ r &lt; 2</strong> by
            multiplying or dividing by 2 (the octave). For example, 9:4 (above
            an octave) becomes 9:8, and 2:3 (below the base) becomes 4:3. Your
            original ratios are kept — only the display and playback change.
          </InfoTip>
        </label>

        <div className="toolbar-spacer" />

        <div className="toolbar-group">
          <label className="toggle" style={{ paddingRight: 0, gap: 6 }}>
            base
            <InfoTip>
              The <strong>base pitch</strong> — the frequency the lower number
              of every ratio is anchored to. With a 3:2 ratio over a base of
              C4 (261.63 Hz), the upper note becomes G4 (392.00 Hz). Type a
              frequency in Hz (e.g. <code>440</code>) or a note name (e.g.{' '}
              <code>C4</code>, <code>A3</code>, <code>F#5</code>).
            </InfoTip>
          </label>
          <div className="base-pitch-stack">
            <div className="base-resolved" aria-live="polite">{baseNoteLabel}</div>
            <input
              type="text"
              value={basePitchInput}
              onChange={(e) => handleBaseChange(e.target.value)}
              style={{ width: 110 }}
              aria-label="base pitch (Hz or note like C4)"
              placeholder="261.63 or C4"
            />
          </div>
          <button
            className={'btn-icon' + (basePlaying ? ' lit' : '')}
            onClick={playBase}
            title="play base pitch"
            aria-label="play base pitch"
          >
            ▶
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          <div className="graph">
            {nodes.length === 0 && (
              <div className="empty-state">
                no nodes yet — add a ratio above, or generate a power sequence.
              </div>
            )}
            {nodes.map((node, i) => (
              <div className="graph-item" key={node.id}>
                <NodeCard
                  node={node}
                  baseFreq={basePitch}
                  bounded={bounded}
                  active={active}
                  onPlay={() => playOne(node)}
                  onDelete={() => deleteNode(node.id)}
                  onChangePlayMode={(m) => updateNode(node.id, { playMode: m })}
                  onChangeDirection={(d) => updateNode(node.id, { direction: d })}
                />
                {i < nodes.length - 1 && (
                  <div
                    className={
                      'connector' +
                      (active && active.nodeId === node.id ? ' active' : '')
                    }
                  />
                )}
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <ConfirmModal
        open={confirmClearOpen}
        title="Clear all nodes?"
        message={
          <>
            This will remove{' '}
            <strong>{nodes.length} node{nodes.length === 1 ? '' : 's'}</strong>{' '}
            from the sequence. The action can't be undone.
          </>
        }
        confirmLabel="Clear all"
        onConfirm={performClearAll}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  )
}
