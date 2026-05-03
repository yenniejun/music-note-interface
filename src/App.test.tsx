// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeAll } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import App from './App'

afterEach(() => cleanup())

beforeAll(() => {
  // jsdom has no AudioContext; stub a minimal one so audio.ts doesn't blow up.
  class FakeOscillator {
    frequency = { setValueAtTime: vi.fn() }
    connect() { return this }
    start() {}
    stop() {}
  }
  class FakeGain {
    gain = {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    }
    connect() { return this }
  }
  class FakeAudioContext {
    currentTime = 0
    state = 'running'
    destination = {}
    createOscillator() { return new FakeOscillator() }
    createGain() { return new FakeGain() }
    resume() { return Promise.resolve() }
  }
  ;(globalThis as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext
})

describe('App', () => {
  it('renders the empty state on first load', () => {
    render(<App />)
    expect(screen.getByText('Interval Explorer')).toBeTruthy()
    expect(screen.getByText(/no nodes yet/i)).toBeTruthy()
  })

  it('adds a new node when the add form is submitted', () => {
    render(<App />)
    const upper = screen.getByLabelText('upper integer') as HTMLInputElement
    const lower = screen.getByLabelText('lower integer') as HTMLInputElement
    fireEvent.change(upper, { target: { value: '5' } })
    fireEvent.change(lower, { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'add' }))
    expect(screen.getAllByText('5').length).toBeGreaterThan(0)
    expect(screen.getAllByText('4').length).toBeGreaterThan(0)
  })

  it('generates a power sequence', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'generate' }))
    // default range -1 to 5 → 7 nodes, each with a "▶ play" button
    const playButtons = screen.getAllByRole('button', { name: /▶ play$/ })
    expect(playButtons.length).toBeGreaterThanOrEqual(7)
  })
})
