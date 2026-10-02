# Sight Reading Genius — Scope

Draft 1, 2026-10-01. Source: Ted's dictated scope.

## Goal

An app for Android tablets and phones that teaches piano sight reading with
flash cards. The app shows a note on the staff, listens to the piano through
the microphone, and marks the answer right or wrong. Piano only.

## Proposed stack

An installable web app (PWA), run in Chrome on Android.

- **TypeScript + React + Vite** for the app.
- **VexFlow** to draw staves, clefs, key signatures, notes and ledger lines.
- **Web Audio API** for microphone input, with pitch detection running in an
  AudioWorklet.
- **Browser local storage** for progress, records and settings. Everything
  stays on the device; no accounts or server.
- **Capacitor** later, if a Play Store listing is wanted. It wraps the same
  code.

Why not native Kotlin: this stack needs no Android toolchain, can be tested in
a desktop browser, and matches Ted's other projects. Microphone latency in
Chrome on Android is good enough for flash cards, where answers are judged in
hundreds of milliseconds, not tens.

## Listening

### Single notes

Reliable. Method: a monophonic pitch detector (McLeod / YIN family) on the
microphone signal.

- **Out-of-tune pianos:** the detected frequency is snapped to the nearest
  semitone, so a note up to a quarter tone off still reads correctly. A
  one-time calibration ("play the A above middle C") measures how flat or
  sharp the whole piano is and shifts the reference pitch to match.
- **False triggers:** a note counts only after a clear attack and a pitch that
  holds steady for a short window, so talking and room noise do not register
  as wrong answers.
- **Octave errors:** the usual failure of pitch detectors on piano. The lowest
  octave and a half is the hard part, because phone microphones barely pick up
  those fundamentals. Handled by checking the harmonic pattern, and by keeping
  those notes for late levels.

### Two notes in succession

Same as single notes, heard one after the other. No extra risk.

### Chords

Workable, with limits. The app does not need to work out which chord was
played from nothing; it knows the chord it asked for and only has to check
that those notes are present and others are not. That is much easier than
general chord recognition.

- Two- and three-note chords in the middle of the keyboard should check well.
- Weak spots: octaves and fifths (their harmonics overlap, so a missing note
  can hide), low and muddy voicings, and a wrong note that happens to be a
  harmonic of a right one.
- Fallbacks if listening is not trustworthy for a drill: self-grading ("did
  you get it?"), or **MIDI input** over USB or Bluetooth for anyone with a
  digital piano, which is exact for any chord.

This needs a prototype against a real piano before chord levels are promised.

## Flash card loop

1. Show a note on the staff.
2. Listen.
3. Right note: green check, next card.
4. Wrong note: show "wrong note" with the correct answer, move on, and bring
   that card back a few cards later.

Response time is recorded on every card.

## Learning design

The methods with the best evidence for this kind of skill, and how the app
uses them:

- **Spaced repetition.** Every note has its own strength score. Weak notes
  come up often, strong ones rarely, and notes mastered earlier return after
  days to check they stuck.
- **Missed cards return soon.** A wrong answer reappears within the same
  session, then at widening gaps.
- **Small steps.** New notes are introduced two or three at a time and mixed
  with known ones, never a full staff at once.
- **Landmark notes first.** Start from middle C, treble G and bass F, then
  fill in outward, so students read by position from anchors, not by counting
  lines.
- **Interleaving.** Once learned, treble and bass and different note groups
  are mixed, not drilled in blocks.
- **Speed as the mastery test.** A note counts as mastered when it is both
  correct and fast, since fluent reading is recognition, not working it out.
- **Short sessions and streaks.** Sessions of a few minutes, a daily streak,
  XP and levels, as in Duolingo.
- **Immediate feedback.** Right or wrong is shown on every card.

## Levels

Levelling up requires an accuracy target and a response-time target on the
current level's notes. Draft order:

1. Landmark notes, then the notes around middle C.
2. Treble staff lines and spaces.
3. Bass staff lines and spaces.
4. Both staves mixed.
5. Ledger lines, starting with the ones students miss most: between the
   staves, then just above treble and just below bass.
6. Accidentals written on the note.
7. Key signatures: the sharp or flat is in the signature, not on the note, so
   in G major an F on the staff must be played as F sharp.
8. Two notes in succession (C then E), then short runs.
9. Intervals and chords played together, subject to the listening prototype.
10. Further drills for advanced students, to be defined.

## Modes

- **Practice.** The adaptive flash card loop above; earns XP.
- **Speed run.** A fixed set of notes against a timer. A wrong note moves to
  the end of the set. The timer stops when every note has been played
  correctly. The time is saved, past attempts are kept, and a new best shows
  "New record".

## Build order

1. Staff rendering and a note-card generator.
2. Microphone listening and single-note detection, with tuning calibration.
   Test on a real piano with a phone and a tablet.
3. Practice mode with spaced repetition, XP and levels 1 to 5.
4. Speed run mode with records.
5. Accidentals and key signatures.
6. Successive notes.
7. Chord prototype, then decide between listening, self-grading and MIDI.

## Decisions (2026-10-01)

- **No Play Store.** Personal use. The app is installed from a web address
  with Chrome's "Add to Home screen"; the address must be HTTPS for the
  microphone to work.
- **Several profiles per device.** Each player has their own level, XP,
  streak, note history and speed-run records.
- **No MIDI for now.** Possible later addition.
- **No teacher view.** No accounts or server.

## Status

Built: profiles, staff rendering, microphone note detection, piano tuning
calibration, practice mode with spaced repetition, XP, streaks and levels 1
to 5, and speed run with records. Listening has not yet been tested against a
real piano.

Next: test on a piano with the tablet and phone, then accidentals and key
signatures.

## Open questions

1. Where to host it so the tablet and phone can install it.
