# Functions

## snippets/keymap.c.snippet.js

- `send_sentence_end` — types `. ` and one-shot Shift; optionally backspaces a leading space first.
- `process_sentence_end_key` — Oryx 1/50. Double-tap sends sentence end; single tap replays the Oryx tap keycode after `SENTENCE_DOUBLE_TAP_TERM`.
- `host_is_apple` — true on macOS/iOS from USB OS detection; Windows/Linux false; otherwise `keymap_config.swap_lctl_lgui`.
- `send_word_delete` — Option+Backspace on Apple, Ctrl+Backspace on Windows/Linux.
- `send_line_delete` — select-line then Backspace: Cmd arrows on Apple, Home/Shift+End on Windows/Linux.
- `process_word_delete_chord` — hold 0/25 then tap 0/51 sends line delete; double-tap 0/51 sends word delete; single tap and hold on 0/51 stay Backspace / layer 2.
- `sentence_end_unwrap` — tap keycode of a mod-tap / layer-tap, otherwise the keycode itself.
- `sentence_end_single_tap` — deferred_exec callback that fires the pending layer-1 single tap.
- `apply_same_hand_shift_guard` — existing Shift same-hand capital suppression.
- `process_record_user` — layer-1 sentence-end, then layer-0 sentence-end, then Shift guard, then `oryx_export_process_record`.
