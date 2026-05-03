export type Ratio = { lower: number; upper: number }

export type PlayMode = 'together' | 'separate' | 'top'
export type Direction = 'ascending' | 'descending'

export type IntervalNode = {
  id: string
  ratio: Ratio
  playMode: PlayMode
  direction: Direction
}

export type ActiveState = {
  nodeId: string
  mode: 'lower' | 'upper' | 'both'
} | null
