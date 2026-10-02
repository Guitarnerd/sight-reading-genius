export type Clef = 'treble' | 'bass'
export type Acc = '' | '#' | 'b'

export interface Card {
  id: string
  clef: Clef
  letter: string
  octave: number
  acc: Acc
  midi: number
}

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// name is scientific pitch: "C4", "F#4", "Bb3". Middle C is C4 (MIDI 60).
function card(clef: Clef, name: string): Card {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name)
  if (!m) throw new Error(`bad note name ${name}`)
  const [, letter, acc, oct] = m
  const octave = Number(oct)
  const midi = 12 * (octave + 1) + SEMI[letter] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0)
  return { id: `${clef}:${name}`, clef, letter, octave, acc: acc as Acc, midi }
}

const cards = (clef: Clef, names: string) => names.split(' ').map((n) => card(clef, n))

export interface Level {
  name: string
  cards: Card[]
}

// Each level adds its cards to everything from the levels before it.
// Card order within a level is the order new notes are introduced.
export const LEVELS: Level[] = [
  {
    name: 'Landmarks around middle C',
    cards: [...cards('treble', 'C4 G4 D4 E4 F4'), ...cards('bass', 'C4 F3 B3 A3 G3')],
  },
  { name: 'Treble staff', cards: cards('treble', 'B4 C5 A4 D5 E5 F5') },
  { name: 'Bass staff', cards: cards('bass', 'D3 C3 E3 B2 A2 G2') },
  {
    name: 'Just outside the staves',
    cards: [...cards('treble', 'G5 B3'), ...cards('bass', 'F2 D4')],
  },
  {
    name: 'Ledger lines',
    cards: [...cards('treble', 'A5 A3 B5 C6'), ...cards('bass', 'E4 E2 D2 C2')],
  },
]

export const pool = (level: number): Card[] => LEVELS.slice(0, level).flatMap((l) => l.cards)

export const midiName = (midi: number) => NAMES[((midi % 12) + 12) % 12]

export const cardName = (c: Card) => c.letter + (c.acc === '#' ? '♯' : c.acc === 'b' ? '♭' : '')
