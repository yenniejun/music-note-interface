# Interval Explorer

A small web tool for exploring just intonation. Compose frequency ratios into scales and hear what they sound like.

Each node is a ratio (e.g. `3:2`, `9:8`). Play one node to hear the interval, or chain nodes to hear a scale. The lower number of each ratio anchors to a configurable base pitch (default: middle C, 261.63 Hz).

## Features

- **Per-node playback** — _together_ (two tones at once) or _separate_ (ascending/descending arpeggio)
- **Sequence playback** — plays the upper note of each ratio in order
- **Power sequence generator** — generate `(p/q)^n` for `n ∈ [from, to]`
- **Octave-bounding** — non-destructive toggle that maps each ratio into `[1, 2)`
- **Sort ascending / descending** by ratio value
- **Drag-to-reorder** with visible connectors between nodes
- **Cents deviation** — each node shows its offset from 12-tone equal temperament

## Stack

- React + TypeScript + Vite
- Web Audio API (sine waves with a short envelope)
- `@dnd-kit` for drag-and-drop
- Vitest for unit tests

## Develop

```sh
npm install
npm run dev      # start the dev server
npm test         # run unit tests
npm run build    # production build
```
