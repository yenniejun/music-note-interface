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

export function playSequence(
  nodes: IntervalNode[],
  baseFreq: number,
  useBounded: boolean,
  setActive: (a: ActiveState) => void,
  onDone: () => void,
) {
  const c = getCtx()
  let cursor = c.currentTime + 0.03

  for (const node of nodes) {
    const ratio = effectiveRatio(node.ratio, useBounded)
    const lowerFreq = baseFreq
    const upperFreq = baseFreq * ratioValue(ratio)

    if (node.playMode === 'together') {
      scheduleTone(lowerFreq, cursor, SEQ_DUR)
      scheduleTone(upperFreq, cursor, SEQ_DUR)
      scheduleCallback(cursor - c.currentTime, () => setActive({ nodeId: node.id, mode: 'both' }))
      cursor += SEQ_DUR
    } else {
      const ascending = node.direction === 'ascending'
      const firstFreq = ascending ? lowerFreq : upperFreq
      const secondFreq = ascending ? upperFreq : lowerFreq
      const firstSide: 'lower' | 'upper' = ascending ? 'lower' : 'upper'
      const secondSide: 'lower' | 'upper' = ascending ? 'upper' : 'lower'

      scheduleTone(firstFreq, cursor, SEQ_DUR)
      scheduleCallback(cursor - c.currentTime, () => setActive({ nodeId: node.id, mode: firstSide }))
      cursor += SEQ_DUR + GAP
      scheduleTone(secondFreq, cursor, SEQ_DUR)
      scheduleCallback(cursor - c.currentTime, () => setActive({ nodeId: node.id, mode: secondSide }))
      cursor += SEQ_DUR
    }
  }

  scheduleCallback(cursor - c.currentTime, () => {
    setActive(null)
    onDone()
  })
}
