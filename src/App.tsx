import { useEffect, useRef, useState } from 'react'
import { freqToMidi, onNote, setA4, startListening, stopListening } from './listen'
import { LEVELS, cardName, midiName, pool, type Card } from './music'
import { Staff } from './Staff'
import { bestRun, grade, isMastered, load, newProfile, pick, save, touchStreak, type Profile } from './store'

type Screen = 'home' | 'practice' | 'speedrun' | 'calibrate'

const SESSION_CARDS = 20
const RETRY_AFTER = 3 // a missed card comes back this many cards later

export function App() {
  const [data] = useState(load)
  const [, setTick] = useState(0)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>('home')

  useEffect(() => setA4(data.a4), [data])

  // Profiles are mutated in place; persist() saves and re-renders.
  const persist = () => {
    save(data)
    setTick((t) => t + 1)
  }
  const profile = data.profiles.find((p) => p.id === profileId)
  const home = () => setScreen('home')

  if (!profile)
    return (
      <Profiles
        profiles={data.profiles}
        onPick={setProfileId}
        onAdd={(name) => {
          const p = newProfile(name)
          data.profiles.push(p)
          persist()
          setProfileId(p.id)
        }}
      />
    )
  if (screen === 'practice') return <Practice profile={profile} persist={persist} onExit={home} />
  if (screen === 'speedrun') return <SpeedRun profile={profile} persist={persist} onExit={home} />
  if (screen === 'calibrate')
    return (
      <Calibrate
        a4={data.a4}
        onSet={(hz) => {
          data.a4 = hz
          setA4(hz)
          persist()
        }}
        onExit={home}
      />
    )
  return <Home profile={profile} go={setScreen} onSwitch={() => setProfileId(null)} />
}

function Profiles(props: { profiles: Profile[]; onPick: (id: string) => void; onAdd: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <main>
      <h1>Sight Reading Genius</h1>
      <h2>Who's playing?</h2>
      <div className="list">
        {props.profiles.map((p) => (
          <button key={p.id} onClick={() => props.onPick(p.id)}>
            {p.name}
            <small>Level {p.level}</small>
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) props.onAdd(name.trim())
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New player name" maxLength={24} />
        <button type="submit" disabled={!name.trim()}>
          Add player
        </button>
      </form>
    </main>
  )
}

function Home({ profile, go, onSwitch }: { profile: Profile; go: (s: Screen) => void; onSwitch: () => void }) {
  const cards = pool(profile.level)
  const mastered = cards.filter((c) => isMastered(profile.cards[c.id])).length
  const best = bestRun(profile, profile.level)
  return (
    <main>
      <h1>{profile.name}</h1>
      <div className="stats">
        <div>
          <b>{profile.level}</b>
          <small>Level</small>
        </div>
        <div>
          <b>{profile.xp}</b>
          <small>XP</small>
        </div>
        <div>
          <b>{profile.streak}</b>
          <small>Day streak</small>
        </div>
      </div>
      <p>
        {LEVELS[profile.level - 1].name}: {mastered} of {cards.length} notes mastered
      </p>
      <progress value={mastered} max={cards.length} />
      <div className="list">
        <button className="primary" onClick={() => go('practice')}>
          Practice
        </button>
        <button onClick={() => go('speedrun')}>
          Speed run
          <small>{best < Infinity ? `Best ${clock(best)}` : 'No record yet'}</small>
        </button>
        <button onClick={() => go('calibrate')}>Tune to this piano</button>
        <button onClick={onSwitch}>Switch player</button>
      </div>
    </main>
  )
}

// Turns the microphone on while a screen is showing.
function useMic() {
  const [error, setError] = useState('')
  useEffect(() => {
    startListening().catch(() => setError('Microphone access is needed to hear the piano.'))
    return stopListening
  }, [])
  return error
}

// Subscribes to heard notes with a handler that always sees current state.
function useNote(handler: (midi: number, freq: number) => void) {
  const latest = useRef(handler)
  latest.current = handler
  useEffect(() => onNote((m, f) => latest.current(m, f)), [])
}

type Phase = 'ask' | 'right' | 'wrong'

function Feedback({ phase, card, played }: { phase: Phase; card: Card; played: number }) {
  if (phase === 'right') return <p className="feedback right">✓</p>
  if (phase === 'wrong')
    return (
      <p className="feedback wrong">
        Wrong note. That was {cardName(card)}, you played {midiName(played)}.
      </p>
    )
  return <p className="feedback">Play this note</p>
}

function Practice({ profile, persist, onExit }: { profile: Profile; persist: () => void; onExit: () => void }) {
  const micError = useMic()
  const [card, setCard] = useState(() => pick(profile))
  const [phase, setPhase] = useState<Phase>('ask')
  const [played, setPlayed] = useState(0)
  const [count, setCount] = useState(0)
  const [right, setRight] = useState(0)
  const [levelUp, setLevelUp] = useState(false)
  const [finished, setFinished] = useState(false)
  const shownAt = useRef(performance.now())
  const retry = useRef<{ card: Card; at: number }[]>([])
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const next = (n: number) => {
    if (n >= SESSION_CARDS) {
      touchStreak(profile)
      persist()
      setFinished(true)
      return
    }
    const i = retry.current.findIndex((r) => r.at <= n && r.card.id !== card.id)
    setCard(i >= 0 ? retry.current.splice(i, 1)[0].card : pick(profile, card.id))
    setPhase('ask')
    shownAt.current = performance.now()
  }

  useNote((midi) => {
    if (phase !== 'ask') return
    const ok = midi === card.midi
    if (grade(profile, card, ok, performance.now() - shownAt.current)) setLevelUp(true)
    persist()
    setPlayed(midi)
    setPhase(ok ? 'right' : 'wrong')
    if (ok) setRight(right + 1)
    else retry.current.push({ card, at: count + RETRY_AFTER })
    const n = count + 1
    setCount(n)
    timer.current = window.setTimeout(() => next(n), ok ? 700 : 2000)
  })

  if (finished)
    return (
      <main>
        <h1>Session done</h1>
        <p>
          {right} of {SESSION_CARDS} correct
        </p>
        {levelUp && <p className="feedback right">Level up! Now level {profile.level}</p>}
        <div className="list">
          <button className="primary" onClick={onExit}>
            Done
          </button>
        </div>
      </main>
    )

  return (
    <main>
      <header>
        <button onClick={onExit}>Quit</button>
        <progress value={count} max={SESSION_CARDS} />
      </header>
      {micError && <p className="wrong">{micError}</p>}
      <Feedback phase={phase} card={card} played={played} />
      <Staff card={card} />
    </main>
  )
}

function SpeedRun({ profile, persist, onExit }: { profile: Profile; persist: () => void; onExit: () => void }) {
  const micError = useMic()
  const [queue, setQueue] = useState<Card[] | null>(null)
  const [phase, setPhase] = useState<Phase>('ask')
  const [played, setPlayed] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<{ ms: number; record: boolean } | null>(null)
  const startedAt = useRef(0)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const running = !!queue && !result
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setElapsed(performance.now() - startedAt.current), 100)
    return () => clearInterval(t)
  }, [running])

  const start = () => {
    setQueue(shuffle(pool(profile.level)))
    setResult(null)
    setPhase('ask')
    setElapsed(0)
    startedAt.current = performance.now()
  }

  useNote((midi) => {
    if (!queue || result || phase !== 'ask') return
    const [card, ...rest] = queue
    const ok = midi === card.midi
    setPlayed(midi)
    setPhase(ok ? 'right' : 'wrong')
    if (ok && !rest.length) {
      const ms = performance.now() - startedAt.current
      const record = ms < bestRun(profile, profile.level)
      profile.runs.push({ level: profile.level, ms, date: new Date().toISOString() })
      persist()
      setResult({ ms, record })
      return
    }
    // A missed note goes to the back of the set.
    timer.current = window.setTimeout(
      () => {
        setQueue(ok ? rest : [...rest, card])
        setPhase('ask')
      },
      ok ? 250 : 1200,
    )
  })

  if (!queue || result) {
    const past = profile.runs.filter((r) => r.level === profile.level).slice(-5).reverse()
    return (
      <main>
        <h1>Speed run</h1>
        {result ? (
          <>
            <p className="big">{clock(result.ms)}</p>
            {result.record && <p className="feedback right">New record!</p>}
          </>
        ) : (
          <p>
            Play every level {profile.level} note ({pool(profile.level).length} notes) as fast as you can. A wrong note
            goes to the back of the set.
          </p>
        )}
        {micError && <p className="wrong">{micError}</p>}
        <div className="list">
          <button className="primary" onClick={start}>
            {result ? 'Go again' : 'Start'}
          </button>
          <button onClick={onExit}>Back</button>
        </div>
        {past.length > 0 && (
          <>
            <h2>Recent runs</h2>
            <ul>
              {past.map((r) => (
                <li key={r.date}>
                  {clock(r.ms)} <small>{new Date(r.date).toLocaleDateString()}</small>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    )
  }

  return (
    <main>
      <header>
        <button onClick={onExit}>Quit</button>
        <b className="clock">{clock(elapsed)}</b>
        <small>{queue.length} left</small>
      </header>
      {micError && <p className="wrong">{micError}</p>}
      <Feedback phase={phase} card={queue[0]} played={played} />
      <Staff card={queue[0]} />
    </main>
  )
}

function Calibrate({ a4, onSet, onExit }: { a4: number; onSet: (hz: number) => void; onExit: () => void }) {
  const micError = useMic()
  const [samples, setSamples] = useState<number[]>([])
  const NEEDED = 3

  useNote((_, freq) => {
    // Only an A within a semitone of concert pitch counts.
    if (samples.length >= NEEDED || Math.abs(freqToMidi(freq, 440) - 69) > 1) return
    const all = [...samples, freq]
    setSamples(all)
    if (all.length === NEEDED) onSet(all.reduce((a, b) => a + b) / NEEDED)
  })

  const cents = Math.round(1200 * Math.log2(a4 / 440))
  return (
    <main>
      <h1>Tune to this piano</h1>
      <p>
        Play the A above middle C {NEEDED} times, letting each one ring. The app will match itself to your piano, so a
        piano that is a little flat or sharp still reads correctly.
      </p>
      {micError && <p className="wrong">{micError}</p>}
      <p className="big">
        {samples.length} / {NEEDED}
      </p>
      <p>
        Current setting: A = {a4.toFixed(1)} Hz
        {cents !== 0 && ` (${Math.abs(cents)} cents ${cents < 0 ? 'flat' : 'sharp'})`}
      </p>
      <div className="list">
        <button onClick={() => setSamples([])}>Measure again</button>
        <button
          onClick={() => {
            onSet(440)
            setSamples([])
          }}
        >
          Reset to 440 Hz
        </button>
        <button className="primary" onClick={onExit}>
          Done
        </button>
      </div>
    </main>
  )
}

function clock(ms: number) {
  const s = ms / 1000
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
