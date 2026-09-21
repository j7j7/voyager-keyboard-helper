# Memory

- Oryx owns the layout; this helper appends QMK behaviour via `snippets/` on each export/flash.
- QMK lives at `/Users/j7/voyager-keyboard/qmk` (ZSA fork, `firmware25`). `qmk` CLI is in `~/.local/bin`.
- Current Oryx export: `zsa_voyager_*_j7-fork_source.zip` → folder `zsa_voyager_j7-fork_source`. `.bin` from Oryx is unused.
- This export has no `get_tapping_term` and no Chordal Hold; those snippet pieces are optional so Space/Shift on 0/50 stays Oryx’s.
- Flashed 21 Sep 2026 (OS-aware line/word delete).
- Do not change chordal hold, Shift flow, HOOKP, or the same-hand Shift guard unless asked.
- Sentence-end physical key is Oryx **50**: right thumb inner, matrix `[11, 5]`.
- **1/50** (layer 1): deferred double-tap. Double-tap sends `. ` + one-shot Shift; single tap still fires the Oryx key after 250 ms. Only when the keycode comes from layer 1.
- **0/50** (layer 0): Space tap / Shift hold stays with Oryx. A second tap (already settled as a tap) backspaces the first space and sends `. ` + one-shot Shift. Holds (`tap.count == 0`) are never intercepted.
- **0/25** held then **0/51** tapped: delete the current line. **Double-tap 0/51**: delete previous word. 0/25 tap/hold stays Enter/Ctrl; 0/51 single tap/hold stays Backspace/layer 2.
- Line/word delete: USB OS detection. Apple: Option+Bspc (word), Cmd+Left then Cmd+Shift+Right then Bspc (line). Windows/Linux: Ctrl+Bspc (word), Home then Shift+End then Bspc (line). Unsure OS falls back to `swap_lctl_lgui`.
