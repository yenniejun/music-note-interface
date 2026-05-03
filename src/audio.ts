import type { ActiveState, IntervalNode, Ratio } from './types'
import { octaveBound, ratioValue } from './music'

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) {
    const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

const ATTACK = 0.01
const RELEASE = 0.1
const PEAK = 0.22
const SINGLE_DUR = 0.8
const SEQ_DUR = 0.6
const GAP = 0.05

function scheduleTone(freq: number, startAt: number, duration: number) {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, startAt)
  osc.connect(gain).connect(c.destination)
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(PEAK, startAt + ATTACK)
  const releaseStart = Math.max(startAt + ATTACK, startAt + duration - RELEASE)
  gain.gain.setValueAtTime(PEAK, releaseStart)
  gain.gain.linearRampToValueAtTime(0, startAt + duration)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.05)
}

let timers: number[] = []
function scheduleCallback(delaySec: number, fn: () => void) {
  const id = window.setTimeout(fn, Math.max(0, delaySec * 1000))
  timers.push(id)
}

export function cancelAll(setActive: (a: ActiveState) => void, setSequencePlaying?: (b: boolean) => void) {
  for (const id of timers) clearTimeout(id)
  timers = []
  setActive(null)
  if (setSequencePlaying) setSequencePlaying(false)
}

export function playBaseTone(baseFreq: number, onActive?: (active: boolean) => void) {
  const c = getCtx()
  const start = c.currentTime + 0.03
  scheduleTone(baseFreq, start, SINGLE_DUR)
  if (onActive) {
    scheduleCallback(start - c.currentTime, () => onActive(true))
    scheduleCallback(start - c.currentTime + SINGLE_DUR, () => onActive(false))
  }
}

function effectiveRatio(ratio: Ratio, useBounded: boolean): Ratio {
  return useBounded ? octaveBound(ratio) : ratio
}

export function playSingleNode(
  node: IntervalNode,
  baseFreq: number,
  useBounded: boolean,
  setActive: (a: ActiveState) => void,
) {
  const c = getCtx()
  const ratio = effectiveRatio(node.ratio, useBounded)
  const lowerFreq = baseFreq
  const upperFreq = baseFreq * ratioValue(ratio)
  const start = c.currentTime + 0.03

  if (node.playMode === 'together') {
    scheduleTone(lowerFreq, start, SINGLE_DUR)
    scheduleTone(upperFreq, start, SINGLE_DUR)
    scheduleCallback(start - c.currentTime, () => setActive({ nodeId: node.id, mode: 'both' }))
    scheduleCallback(start - c.currentTime + SINGLE_DUR, () => setActive(null))
  } else {
    const ascending = node.direction === 'ascending'
    const firstFreq = ascending ? lowerFreq : upperFreq
    const secondFreq = ascending ? upperFreq : lowerFreq
    const firstSide: 'lower' | 'upper' = ascending ? 'lower' : 'upper'
    const secondSide: 'lower' | 'upper' = ascending ? 'upper' : 'lower'

    scheduleTone(firstFreq, start, SINGLE_DUR)
    scheduleTone(secondFreq, start + SINGLE_DUR + GAP, SINGLE_DUR)
    scheduleCallback(start - c.currentTime, () => setActive({ nodeId: node.id, mode: firstSide }))
    scheduleCallback(start - c.currentTime + SINGLE_DUR + GAP, () => setActive({ nodeId: node.id, mode: secondSide }))
    scheduleCallback(start - c.currentTime + 2 * SINGLE_DUR + GAP, () => setActive(null))
  }
}

export type SequenceMode = 'top' | 'harmony'

export function playSequence(
  nodes: IntervalNode[],
  baseFreq: number,
  useBounded: boolean,
  setActive: (a: ActiveState) => void,
  onDone: () => void,
  mode: SequenceMode = 'top',
) {
  const c = getCtx()
  const start = c.currentTime + 0.03
  nodes.forEach((node, i) => {
    const ratio = effectiveRatio(node.ratio, useBounded)
    const upperFreq = baseFreq * ratioValue(ratio)
    const at = start + i * SEQ_DUR
    if (mode === 'harmony') {
      scheduleTone(baseFreq, at, SEQ_DUR)
      scheduleTone(upperFreq, at, SEQ_DUR)
      scheduleCallback(at - c.currentTime, () => setActive({ nodeId: node.id, mode: 'both' }))
    } else {
      scheduleTone(upperFreq, at, SEQ_DUR)
      scheduleCallback(at - c.currentTime, () => setActive({ nodeId: node.id, mode: 'upper' }))
    }
  })
  const totalDelay = start - c.currentTime + nodes.length * SEQ_DUR
  scheduleCallback(totalDelay, () => {
    setActive(null)
    onDone()
  })
}
