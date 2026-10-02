import { useEffect, useRef } from 'react'
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow'
import type { Card } from './music'

const SCALE = 1.8
const W = 190
const H = 190

export function Staff({ card }: { card: Card }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current!
    el.innerHTML = ''
    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(W * SCALE, H * SCALE)
    const g = renderer.getContext()
    g.scale(SCALE, SCALE)

    const stave = new Stave(5, 45, W - 10)
    stave.addClef(card.clef).setContext(g).draw()

    const note = new StaveNote({
      clef: card.clef,
      keys: [`${card.letter.toLowerCase()}${card.acc}/${card.octave}`],
      duration: 'w',
    })
    if (card.acc) note.addModifier(new Accidental(card.acc))
    const voice = new Voice({ num_beats: 4, beat_value: 4 }).addTickables([note])
    new Formatter().joinVoices([voice]).format([voice], W - 90)
    voice.draw(g, stave)
  }, [card])

  return <div className="staff" data-card={card.id} ref={ref} />
}
