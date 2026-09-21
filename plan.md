# Plan

- Keep Oryx as the layout source; inject firmware-only behaviour in snippets.
- Sentence end: double-tap Oryx key 50. Layer 1 defers the first tap. Layer 0 (Space/Shift) only rewrites a second tap so hold-Shift is unchanged.
- Do not retune tap/hold, chordal hold, or other keys.
- Flash remains `node updateKeyboard.js` / `./flashKeyboard.sh` when the user asks.
