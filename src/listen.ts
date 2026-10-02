import { PitchDetector } from 'pitchy'

type NoteHandler = (midi: number, freq: number) => void

const FFT = 4096
const MIN_CLARITY = 0.9
const MIN_RMS = 0.01
const STABLE_FRAMES = 3 // same pitch this many polls in a row counts as a note
const POLL_MS = 30
const REATTACK = 1.8 // volume jump that counts as the same key struck again

const handlers = new Set<NoteHandler>()
let ctx: AudioContext | null = null
let stream: MediaStream | null = null
let timer: number | undefined

// Frequency of the A above middle C on this piano; set by calibration.
let a4 = 440
export const setA4 = (hz: number) => {
  a4 = hz
}

export const freqToMidi = (freq: number, ref = a4) => 69 + 12 * Math.log2(freq / ref)

export function onNote(h: NoteHandler) {
  handlers.add(h)
  return () => {
    handlers.delete(h)
  }
}

const emit = (midi: number, freq: number) => handlers.forEach((h) => h(midi, freq))

export async function startListening() {
  if (ctx) return
  // Phone call processing mangles piano tone, so turn all of it off.
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  })
  ctx = new AudioContext()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = FFT
  ctx.createMediaStreamSource(stream).connect(analyser)

  const detector = PitchDetector.forFloat32Array(FFT)
  const buf = new Float32Array(FFT)
  const sampleRate = ctx.sampleRate

  let candidate = -1
  let run = 0
  let held = -1 // note already reported and still ringing
  let heldFloor = 0 // quietest it has been since it was reported

  timer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(buf)
    let sum = 0
    for (let i = 0; i < FFT; i++) sum += buf[i] * buf[i]
    const rms = Math.sqrt(sum / FFT)
    if (rms < MIN_RMS) {
      candidate = held = -1
      run = 0
      return
    }
    const [freq, clarity] = detector.findPitch(buf, sampleRate)
    if (clarity < MIN_CLARITY || freq < 50 || freq > 2200) {
      run = 0
      return
    }
    const midi = Math.round(freqToMidi(freq))
    if (midi === candidate) run++
    else {
      candidate = midi
      run = 1
    }
    if (midi === held) {
      if (rms > heldFloor * REATTACK) held = -1
      else heldFloor = Math.min(heldFloor, rms)
    }
    if (run >= STABLE_FRAMES && midi !== held) {
      held = midi
      heldFloor = rms
      emit(midi, freq)
    }
  }, POLL_MS)
}

export function stopListening() {
  window.clearInterval(timer)
  stream?.getTracks().forEach((t) => t.stop())
  ctx?.close()
  ctx = stream = null
}

// Lets a dev build answer cards from the console without a piano.
if (import.meta.env.DEV) {
  ;(window as any).__srgPlay = (midi: number) => emit(midi, a4 * 2 ** ((midi - 69) / 12))
}
