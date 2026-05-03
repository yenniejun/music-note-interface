import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ActiveState, IntervalNode } from './types'
import {
  centsFromTET,
  formatHz,
  noteNameFromFreq,
  octaveBound,
  ratioValue,
} from './music'

type Props = {
  node: IntervalNode
  baseFreq: number
  bounded: boolean
  active: ActiveState
  onPlay: () => void
  onDelete: () => void
  onChangePlayMode: (mode: 'together' | 'separate') => void
  onChangeDirection: (dir: 'ascending' | 'descending') => void
}

export function NodeCard({
  node,
  baseFreq,
  bounded,
  active,
  onPlay,
  onDelete,
  onChangePlayMode,
  onChangeDirection,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: node.id })

  const ratio = bounded ? octaveBound(node.ratio) : node.ratio
  const lowerFreq = baseFreq
  const upperFreq = baseFreq * ratioValue(ratio)
  const upperNote = noteNameFromFreq(upperFreq)
  const lowerNote = noteNameFromFreq(lowerFreq)
  const cents = centsFromTET(ratio)
  const centsRounded = Math.round(cents * 100) / 100

  const isActive = active?.nodeId === node.id
  const mode = isActive ? active!.mode : undefined

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const centsClass = centsRounded > 0.05 ? 'pos' : centsRounded < -0.05 ? 'neg' : ''
  const centsLabel = Math.abs(centsRounded) < 0.05
    ? '±0.00¢'
    : `${centsRounded > 0 ? '+' : ''}${centsRounded.toFixed(2)}¢`

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        'node' +
        (isDragging ? ' dragging' : '') +
        (isActive ? ' active ' + (mode ?? '') : '')
      }
    >
      <div className="node-handle" {...attributes} {...listeners} title="drag to reorder">⋮⋮</div>
      <button
        className="btn-icon node-delete btn-danger"
        onClick={onDelete}
        title="remove"
        aria-label="remove node"
      >
        ✕
      </button>

      <div className={'ratio' + (bounded ? ' bounded' : '')}>
        <span className="num">{ratio.upper}</span>
        <span className="colon">:</span>
        <span className="den">{ratio.lower}</span>
      </div>

      <div className="note-stack">
        <div className={'note-row upper' + (mode === 'upper' || mode === 'both' ? ' lit' : '')}>
          <span className="note-tag">▲</span>
          <span className="note-name">{upperNote.name}{upperNote.octave}</span>
          <span className="note-hz">{formatHz(upperFreq)} Hz</span>
        </div>
        <div className={'note-row lower' + (mode === 'lower' || mode === 'both' ? ' lit' : '')}>
          <span className="note-tag">▼</span>
          <span className="note-name">{lowerNote.name}{lowerNote.octave}</span>
          <span className="note-hz">{formatHz(lowerFreq)} Hz</span>
        </div>
      </div>

      <div className={'cents ' + centsClass}>{centsLabel}</div>

      <div className="node-controls">
        <div className="play-row">
          <button className="btn-primary" onClick={onPlay}>▶ play</button>
        </div>

        <div className="mode-toggle" role="group" aria-label="play mode">
          <button
            type="button"
            className={node.playMode === 'together' ? 'on' : ''}
            onClick={() => onChangePlayMode('together')}
          >
            together
          </button>
          <button
            type="button"
            className={node.playMode === 'separate' ? 'on' : ''}
            onClick={() => onChangePlayMode('separate')}
          >
            separate
          </button>
        </div>

        {node.playMode === 'separate' && (
          <div className="mode-toggle" role="group" aria-label="direction">
            <button
              type="button"
              className={node.direction === 'ascending' ? 'on' : ''}
              onClick={() => onChangeDirection('ascending')}
            >
              ↑ asc
            </button>
            <button
              type="button"
              className={node.direction === 'descending' ? 'on' : ''}
              onClick={() => onChangeDirection('descending')}
            >
              ↓ desc
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
