# Sight Reading Genius

Piano sight reading flash cards for Android tablets and phones. The app shows
a note on the staff, listens to the piano through the microphone, and marks
the answer. See [SCOPE.md](SCOPE.md) for the plan and current status.

## Run it

    npm install
    npm run dev

`npm run build` produces a static site in `dist/` that can be served from any
HTTPS host and installed from Chrome with "Add to Home screen".

In a dev build, `__srgPlay(60)` in the browser console answers the current
card with that MIDI note, for testing without a piano.
