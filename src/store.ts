import { LEVELS, pool, type Card } from './music'

export interface CardStat {
  box: number // 0..5, Leitner box
  due: number // timestamp when it should be reviewed again
  seen: number
  correct: number
  ms: number // running average response time
}

export interface RunRecord {
  level: number
  ms: number
  date: string
}

export interface Profile {
  id: string
  name: string
  level: number
  xp: number
  streak: number
  lastDay: string
  cards: Record<string, CardStat>
  runs: RunRecord[]
}

interface Data {
  profiles: Profile[]
  a4: number
}

const KEY = 'srg.v1'
const HOUR = 3600_000
const INTERVAL_H = [0, 0, 0, 24, 72, 168]
export const MASTERED_BOX = 3
export const FAST_MS = 4000

export function load(): Data {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // unreadable storage starts fresh
  }
  return { profiles: [], a4: 440 }
}

export function save(data: Data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // storage full or blocked; progress stays in memory for this session
  }
}

export const newProfile = (name: string): Profile => ({
  id: crypto.randomUUID(),
  name,
  level: 1,
  xp: 0,
  streak: 0,
  lastDay: '',
  cards: {},
  runs: [],
})

const blank = (): CardStat => ({ box: 0, due: 0, seen: 0, correct: 0, ms: 0 })

export const isMastered = (s?: CardStat) => !!s && s.box >= MASTERED_BOX && s.ms <= FAST_MS

// Records an answer and returns true if it levelled the profile up.
export function grade(p: Profile, card: Card, right: boolean, ms: number): boolean {
  const s = (p.cards[card.id] ??= blank())
  s.ms = s.seen ? s.ms * 0.7 + ms * 0.3 : ms
  s.seen++
  if (right) {
    s.correct++
    s.box = Math.min(5, s.box + 1)
    p.xp += ms <= 2000 ? 15 : 10
  } else {
    s.box = Math.max(0, s.box - 2)
  }
  s.due = Date.now() + INTERVAL_H[s.box] * HOUR

  if (p.level < LEVELS.length && pool(p.level).every((c) => isMastered(p.cards[c.id]))) {
    p.level++
    return true
  }
  return false
}

// Picks the next practice card: new notes a few at a time, weak and due notes most often.
export function pick(p: Profile, lastId?: string): Card {
  const all = pool(p.level)
  const seen = all.filter((c) => p.cards[c.id]?.seen)
  const learning = seen.filter((c) => p.cards[c.id].box < 2).length
  const fresh = all.find((c) => !p.cards[c.id]?.seen)
  if (fresh && learning < 3) return fresh

  const options = seen.filter((c) => c.id !== lastId)
  if (!options.length) return seen[0] ?? all[0]
  const now = Date.now()
  const weights = options.map((c) => {
    const s = p.cards[c.id]
    return (6 - s.box) * (s.due <= now ? 3 : 0.5)
  })
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < options.length; i++) {
    r -= weights[i]
    if (r <= 0) return options[i]
  }
  return options[options.length - 1]
}

// Local calendar day, so a streak rolls over at the player's midnight.
const day = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

export function touchStreak(p: Profile) {
  const today = day(new Date())
  if (p.lastDay === today) return
  const yesterday = day(new Date(Date.now() - 24 * HOUR))
  p.streak = p.lastDay === yesterday ? p.streak + 1 : 1
  p.lastDay = today
}

export const bestRun = (p: Profile, level: number) =>
  p.runs.filter((r) => r.level === level).reduce((b, r) => Math.min(b, r.ms), Infinity)
