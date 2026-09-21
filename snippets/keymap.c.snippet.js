module.exports = {

  top:`
#define MACRO_SPEED 30

#define LAYER_ALT 2
#define LAYER_NUMBERS 3
#define LAYER_NAV 4
#define LAYER_CODING 5
#define LAYER_CONTROL 6
#define LAYER_DELETE 14


`,

  bottom:`



#ifdef CHORDAL_HOLD
// Chordal Hold: when another key is pressed before the tapping term, decide
// whether the tap-hold key may still settle as held. Returning true only
// *permits* a hold (the tapping term / permissive-hold / hold-on-other-key-press
// still make the final tap-vs-hold call); returning false forces an immediate
// tap. Thumbs are '*' in chordal_hold_layout, so get_chordal_hold_default already
// permits a hold whenever a thumb is the held key OR the next key -- only the
// non-'*' keys need to be listed explicitly here.
bool get_chordal_hold(uint16_t tap_hold_keycode,
                      keyrecord_t* tap_hold_record,
                      uint16_t other_keycode,
                      keyrecord_t* other_record) {
  // DANCE_0 is right-home (not a thumb) -> permit it to chord with a R mod-tap.
  if (other_keycode == TD(DANCE_0)) return true;

  // Same-hand shortcut chords that should still be allowed to hold.
  if (tap_hold_keycode == MT(MOD_LGUI, KC_D) && other_keycode == KC_R) return true; // cmd+r reload
  if (tap_hold_keycode == MT(MOD_LGUI, KC_D) && other_keycode == KC_T) return true; // cmd+t new tab
  if (tap_hold_keycode == MT(MOD_LGUI, KC_D) && other_keycode == MT(MOD_LSFT, KC_F)) return true; // cmd+f find

  // '=' is left-home (not a thumb), so exempt it explicitly. V is intentionally
  // NOT exempt: digits live on the right hand, so the default opposite-hands rule
  // gives an instant layer for digits while still typing a same-hand 'v'.
  if (tap_hold_keycode == LT(LAYER_ALT, KC_EQUAL)) return true;

  // Home-row GUI/Ctrl/Alt fall through here: same-hand neighbours settle as a
  // tap; opposite-hand and any '*' thumb neighbour is permitted to hold.
  return get_chordal_hold_default(tap_hold_record, other_record);
}
#endif



bool get_permissive_hold(uint16_t keycode, keyrecord_t *record) {
    switch (keycode) {
        case MT(MOD_LSFT, KC_F):
        case MT(MOD_RSFT, KC_J):
        case LT(LAYER_NUMBERS,KC_V):    // V -> number layer on next keypress

        // for maya, sturdy and colemak
        case MT(MOD_LSFT, KC_T):
        case MT(MOD_LSFT, KC_S):
        case MT(MOD_LSFT, KC_D):

        case MT(MOD_RSFT, KC_N):
        case MT(MOD_RSFT, KC_H):
            return true;
        default:
            return false;
    }
}

// Layer-taps that switch layers immediately on any next keypress. Used both by
// QMK's process_action() path and as the delegate base for the next-key-aware
// callback below.
bool get_hold_on_other_key_press(uint16_t keycode, keyrecord_t *record) {
    switch (keycode) {
        case LT(LAYER_ALT,KC_EQUAL):    // layer tap equal for numeric layer
        case LT(LAYER_CODING,KC_ENTER): // left thumb
        case LT(LAYER_DELETE,KC_BSPC):  // left thumb
        case LT(LAYER_NAV,KC_TAB):      // right thumb
            return true;
        default:
            return false;
    }
}

// Per-position whitelist for the Shift home-row mods. When a Shift mod-tap is
// pending and the *next* key is pressed, we read that next key's matrix cell here
// and eager-hold Shift only on a matching mark; everything else falls through to
// Chordal Hold / the tapping term (so rolling onto a letter taps -- fixes kijk and
// mid-word capitals). '1' = hold when LEFT shift (F) is held, '2' = hold when
// RIGHT shift (J) is held, '.' = never. The marked cells are the non-letter keys
// on the opposite hand (number row + edge symbols), so F+/ -> ? still fires while
// letters stay '.'. Same LAYOUT shape as chordal_hold_layout -- tune any cell.
const char shift_hold_on_other_layout[MATRIX_ROWS][MATRIX_COLS] PROGMEM = LAYOUT(
  '2','2','2','2','2','2',   '1','1','1','1','1','1',
  '2','.','.','.','.','.',   '.','.','.','.','.','1',
  '2','.','.','.','.','.',   '.','.','.','.','1','1',
  '2','.','.','.','.','.',   '.','.','1','1','1','1',
              '.','.',   '.','.'
);

// Any mod-tap whose hold is a Shift, on either hand and on any of the alternate
// layouts (F/J on QWERTY, T/N on colemak, ...). Matching on the mods field
// rather than a list of keycodes keeps every Shift home-row mod in scope.
static bool is_shift_mod_tap(uint16_t keycode) {
    return IS_QK_MOD_TAP(keycode) && (QK_MOD_TAP_GET_MODS(keycode) & MOD_MASK_SHIFT) != 0;
}

// Handedness of a physical key, read from the Chordal Hold map Oryx generates
// ('L' / 'R' / '*'). Thumbs are '*' and belong to neither hand, so they are
// never treated as "same hand" below. Only real key events have a meaningful
// position: a combo fires with key (0,0), which would otherwise read as a
// left-hand key -- get_chordal_hold_default() makes the same check.
#define SHIFT_HAND_LEFT  (1 << 0)
#define SHIFT_HAND_RIGHT (1 << 1)

static uint8_t hand_bit_of_event(keyevent_t event) {
    if (!IS_KEYEVENT(event)) return 0;
#ifdef CHORDAL_HOLD
    switch (chordal_hold_handedness(event.key)) {
        case 'L': return SHIFT_HAND_LEFT;
        case 'R': return SHIFT_HAND_RIGHT;
        default:  return 0;
    }
#else
    return 0;
#endif
}

// The real modifier byte this mod-tap registers when it settles as a hold.
// QK_MOD_TAP_GET_MODS returns the packed 5-bit field where bit 4 selects the
// right-hand mods; the report format puts right-hand mods in the high nibble.
static uint8_t shift_mod_bits_of_mod_tap(uint16_t keycode) {
    const uint8_t packed_mods = QK_MOD_TAP_GET_MODS(keycode);
    const uint8_t real_mods   = (packed_mods & 0x10) ? (uint8_t)((packed_mods & 0x0F) << 4)
                                                     : (packed_mods & 0x0F);
    return real_mods & MOD_MASK_SHIFT;
}

// Hands whose Shift mod-tap is down. Set on the press, cleared on the *processed*
// release rather than the physical one: when a mod-tap has settled as a hold, QMK
// defers its release until the current tapping finishes ("Modifier should be
// retained till end of this tapping", action_tapping.c), so the Shift is still
// registered with the host long after the key physically came up. Clearing early
// would blind the guard for exactly that window -- the J-up-before-K-up roll,
// which is the eindeliK case this all exists to fix.
static uint8_t held_shift_hands = 0;

// The actual Shift bits each hand's held mod-tap registers (MOD_BIT(KC_LSFT) /
// MOD_BIT(KC_RSFT)). The guard strips ONLY these bits: Shift from any other
// source (a plain Shift key on another layer, Caps Word) is deliberate and must
// never be captured -- its owner's release would no-op while the bits sit in
// the borrow, and the restore would then re-add Shift that nothing will ever
// unregister: a hanging Shift with no key held.
static uint8_t held_shift_mod_bits_left  = 0;
static uint8_t held_shift_mod_bits_right = 0;

// Hands whose held Shift has already put a capital on the wire -- an
// opposite-hand letter went out under it. That capital is proof the hold was
// meant, so for the rest of it the same-hand guard stands down and every
// following letter capitalises too: GRAPH, not GRAph. Cleared with the hold, so
// the next Shift press starts guarded again.
static uint8_t shift_capital_produced_hands = 0;

// Shift bits taken off the report for one same-hand keypress (see the guard
// below), plus the lending hand and the key that borrowed them so they can be
// handed back.
static uint8_t  stripped_shift_mods = 0;
static uint8_t  stripped_shift_hand = 0;
static keypos_t stripped_shift_key;

// Only ever hands Shift back while the mod-tap that lent it is still down --
// the lending hand is counted out on that key's *processed* release, which is
// also where the pending restore is dropped, so Shift can never be added to a
// report that has no key holding it down.
static void restore_stripped_shift(void) {
    if (stripped_shift_mods != 0 && (held_shift_hands & stripped_shift_hand) != 0) {
        add_mods(stripped_shift_mods);
        send_keyboard_report();
    }
    stripped_shift_mods = 0;
    stripped_shift_hand = 0;
}

// Drop the pending restore without re-registering.
static void forget_stripped_shift(void) {
    stripped_shift_mods = 0;
    stripped_shift_hand = 0;
}

// Flow-state tracking for the Shift mod-taps. A Shift press that lands within
// SHIFT_FLOW_TERM ms of the previous keypress is "in flow" (mid-word roll, e.g.
// the f in fiets) and keeps the conservative matrix behaviour below. A Shift
// press after a longer pause is "out of flow" (start of a word/sentence, e.g.
// Ik) and eager-holds on ANY next key, so the capital fires the moment the
// letter goes down instead of depending on release order / the tapping term.
// pre_process_record_user sees every event BEFORE the tap-hold buffering, so
// the gap is measured at the moment Shift itself is pressed.
#define SHIFT_FLOW_TERM 300

// Out of flow, Shift should also reach the OS quickly on its own -- no next key
// needed -- so it is live as a real modifier for a mouse click or a slow
// capital. In flow the per-key term from the Oryx export is kept.
#define SHIFT_OUT_OF_FLOW_HOLD_TERM 100

// Tracked per hand, not as one flag: both Shift mod-taps can be in play at once,
// and a shared flag would let the second press silently rewrite the first key's
// pending term and eager-hold rule mid-flight.
static uint16_t shift_flow_last_press  = 0;
static uint8_t  shift_out_of_flow_hands = 0;

bool pre_process_record_user(uint16_t keycode, keyrecord_t *record) {
    if (record->event.pressed) {
        const uint8_t shift_hand =
            is_shift_mod_tap(keycode) ? hand_bit_of_event(record->event) : 0;

        if (shift_hand != 0) {
            // Assigned both ways on every press, so no stale flag can carry over
            // from a previous hold of the same Shift.
            if (TIMER_DIFF_16(record->event.time, shift_flow_last_press) > SHIFT_FLOW_TERM) {
                shift_out_of_flow_hands |= shift_hand;
            } else {
                shift_out_of_flow_hands &= ~shift_hand;
            }
            held_shift_hands |= shift_hand;
            if (shift_hand == SHIFT_HAND_LEFT) {
                held_shift_mod_bits_left  |= shift_mod_bits_of_mod_tap(keycode);
            } else {
                held_shift_mod_bits_right |= shift_mod_bits_of_mod_tap(keycode);
            }
        }
        shift_flow_last_press = record->event.time;
    }
    return true;
}

// Next-key-aware hold-on-other-key-press (needs the patchQmkCore mod).
//  - Shift mod-taps (F/J): out of flow -> eager-hold on any next key (Chordal
//    Hold still forces same-hand chords to tap first, so this effectively means
//    any opposite-hand key, letters included). In flow -> consult
//    shift_hold_on_other_layout above, so letter rolls keep tapping (kijk).
//  - Other home-row mods (GUI/Ctrl/Alt): eager-hold on any opposite-hand key.
//  - Layer-taps (thumbs / V / =): fire on any next key.
bool get_hold_on_other_key_press_next(uint16_t keycode, keyrecord_t *record,
                                      uint16_t other_keycode, keyrecord_t *other_record) {
    char want = 0;
    switch (keycode) {
        case MT(MOD_LSFT, KC_F): want = '1'; break;  // left shift
        case MT(MOD_RSFT, KC_J): want = '2'; break;  // right shift
    }
    if (want != 0) {
        uint8_t row = other_record->event.key.row;
        uint8_t col = other_record->event.key.col;
        bool will_allow_quick_shift = (char)pgm_read_byte(&shift_hold_on_other_layout[row][col]) == want;
        if (will_allow_quick_shift) {
          return true;
        }
        return (shift_out_of_flow_hands & hand_bit_of_event(record->event)) != 0;
    }

    return get_hold_on_other_key_press(keycode, record);
}


uint16_t get_quick_tap_term(uint16_t keycode, keyrecord_t *record) {
    switch (keycode) {
        case LT(LAYER_DELETE,KC_BSPC):
            return 0;
        default:
            return QUICK_TAP_TERM;
    }
}

// The FIRST capital must come from the OTHER hand. Chordal Hold already enforces
// that while the Shift mod-tap is still undecided, but once Shift has settled as
// a hold -- the tapping term expired with no interrupting key -- nothing stops
// the next same-hand letter from being capitalised: that is eindeliJK coming out
// as eindeliK. So while a Shift mod-tap is held, a letter on the SAME hand has
// Shift stripped from its report and typed lowercase; Shift is handed back right
// after, still live for the next off-hand key.
//
// That suspicion is only warranted until the hold proves itself. An accidental
// hold is one the user never meant, so it never gets an off-hand capital out of
// the way first -- whereas a deliberate one does, immediately. So the moment an
// opposite-hand letter goes out capitalised, the hold is proven and the guard
// stands down for the rest of it: GRAPH stays GRAPH instead of turning into
// GRAph when the word crosses back to the Shift's own hand. The proof is per
// hand and dies with the hold, so the next Shift press is guarded again.
//
// The Shift key's own letter is deliberately NOT typed out here. By the time the
// guard runs, Shift has already gone to the OS as a modifier -- that decision is
// on the wire and stands, so the key produces a modifier or nothing, never a
// late letter.
//
// Modifier stacks are safe because this runs on the tap-vs-hold *decision*, not
// on the physical press: for a tap-hold key, action_tapping_process() buffers the
// event and only calls process_record() once the FSM has settled it, with
// tap.count set (1 = tap, 0 = hold). So F + D with D held past its term is
// Shift+Cmd -- D arrives here as a hold, is not a letter at all, and Shift is
// never touched. Held D that is *tapped* arrives as tap.count 1 and is a letter.
static void apply_same_hand_shift_guard(uint16_t keycode, keyrecord_t *record) {
    const uint8_t key_hand = hand_bit_of_event(record->event);

    if (!record->event.pressed) {
        // The Shift mod-tap is only counted out here, on its processed release --
        // see held_shift_hands. Its Shift is being unregistered right now, so any
        // borrowed Shift is dropped rather than handed back.
        if (is_shift_mod_tap(keycode) && key_hand != 0) {
            held_shift_hands             &= ~key_hand;
            shift_capital_produced_hands &= ~key_hand;
            if (key_hand == SHIFT_HAND_LEFT) {
                held_shift_mod_bits_left  = 0;
            } else {
                held_shift_mod_bits_right = 0;
            }
            forget_stripped_shift();
            return;
        }
        // Hand Shift back once the letter that borrowed the report lets go.
        if (record->event.key.row == stripped_shift_key.row &&
            record->event.key.col == stripped_shift_key.col) {
            restore_stripped_shift();
        }
        return;
    }

    // Every key gets a complete report: whatever Shift was borrowed for the
    // previous keypress goes back before this one is judged on its own merits.
    restore_stripped_shift();

    // Nothing to weigh without a Shift mod-tap down, and a '*' thumb belongs to
    // neither hand, so it is never same-hand and never a capital either.
    if (key_hand == 0 || held_shift_hands == 0) return;

    // A tap-hold key that settled as a HOLD is a modifier or a layer, never a
    // letter -- D held past its term is Cmd, so leave Shift alone and let the
    // stack build. Only a settled tap emits a character worth guarding.
    const bool is_tap_hold = IS_QK_MOD_TAP(keycode) || IS_QK_LAYER_TAP(keycode);
    if (is_tap_hold && record->tap.count == 0) return;

    const uint16_t tap_keycode = is_tap_hold ? QK_MOD_TAP_GET_TAP_KEYCODE(keycode) : keycode;
    if (tap_keycode < KC_A || tap_keycode > KC_Z) return;  // letters only

    // A GUI/Ctrl/Alt already down means this is a shortcut chord, not typing --
    // Shift belongs in it and no capital is being written either, so this counts
    // for neither side. Cmd+Shift+A must stay Cmd+Shift+A even though A sits on
    // the same hand as the Shift (and A is itself a mod-tap, so it does reach
    // this point as a settled tap).
    if ((get_mods() & ~MOD_MASK_SHIFT) != 0) return;

    // An opposite-hand letter under a live Shift IS the capital, and it goes out
    // untouched. Remember that it did: from here until the Shift is released the
    // hold is proven deliberate, so the guard below stands down and the rest of
    // the word capitalises with it.
    if ((held_shift_hands & key_hand) == 0) {
        if ((get_mods() & MOD_MASK_SHIFT) != 0) {
            shift_capital_produced_hands |= held_shift_hands;
        }
        return;
    }

    // A Shift held on the opposite hand as well always wins.
    if (held_shift_hands != key_hand) return;

    // The capital run: this hold has already written a capital, so the letter is
    // meant to be one too -- GRAPH rather than GRAph.
    if ((shift_capital_produced_hands & key_hand) != 0) return;

    // Borrow only the bits the same-hand mod-tap itself registered. Shift from
    // any other source (a plain Shift key, Caps Word) is deliberate and stays,
    // so that capital is typed -- and a bit whose owner might be released
    // mid-borrow is never re-added by the restore. Zero here also covers the
    // still-undecided mod-tap: Chordal Hold has it.
    const uint8_t lendable_shift_mods =
        (key_hand == SHIFT_HAND_LEFT) ? held_shift_mod_bits_left : held_shift_mod_bits_right;
    const uint8_t shift_mods = get_mods() & lendable_shift_mods;
    if (shift_mods == 0) return;

    del_mods(shift_mods);
    send_keyboard_report();
    stripped_shift_mods = shift_mods;
    stripped_shift_hand = key_hand;
    stripped_shift_key  = record->event.key;
}

// Oryx .../1/50: layer 1, right thumb inner. Double-tap sends ". " and a
// one-shot Shift so the next letter is capitalised; single tap keeps whatever
// Oryx assigned. Matched on the layer the keycode came from so a transparent
// layer-1 cell still falls through to the base-layer thumb untouched.
#define SENTENCE_END_LAYER 1
#define SENTENCE_END_ROW   11
#define SENTENCE_END_COL   5
#define SENTENCE_DOUBLE_TAP_TERM 250

static deferred_token sentence_end_token = INVALID_DEFERRED_TOKEN;
static uint16_t       sentence_end_tap_kc = KC_NO;
static uint16_t       sentence_space_tap_time = 0;
static bool           sentence_space_tapped = false;
static bool           sentence_space_skip_release = false;
static bool           sentence_after_space = false;
static bool           sentence_start_pending = false;
static uint8_t        pronoun_state = 0;

#define PRONOUN_NONE 0
#define PRONOUN_I    1
#define PRONOUN_IM   2
#define PRONOUN_APOS 3

static bool is_sentence_end_switch(keyrecord_t *record) {
    return record->event.key.row == SENTENCE_END_ROW &&
           record->event.key.col == SENTENCE_END_COL;
}

static void send_sentence_end(bool replace_leading_space) {
    if (replace_leading_space) {
        tap_code(KC_BSPC);
    }
    tap_code(KC_DOT);
    tap_code(KC_SPC);
    set_oneshot_mods(MOD_BIT(KC_LSFT));
    sentence_start_pending     = true;
    sentence_after_space       = false;
    pronoun_state              = PRONOUN_NONE;
}

static uint16_t sentence_end_unwrap(uint16_t keycode) {
    if (IS_QK_MOD_TAP(keycode))   return QK_MOD_TAP_GET_TAP_KEYCODE(keycode);
    if (IS_QK_LAYER_TAP(keycode)) return QK_LAYER_TAP_GET_TAP_KEYCODE(keycode);
    return keycode;
}

static uint32_t sentence_end_single_tap(uint32_t trigger_time, void *cb_arg) {
    (void)trigger_time;
    (void)cb_arg;
    const uint16_t tap_kc = sentence_end_tap_kc;
    sentence_end_token  = INVALID_DEFERRED_TOKEN;
    sentence_end_tap_kc = KC_NO;
    if (tap_kc > KC_NO && tap_kc < QK_MODS) {
        tap_code16(tap_kc);
    }
    return 0;
}

static bool process_sentence_end_key(uint16_t keycode, keyrecord_t *record) {
    if (!is_sentence_end_switch(record)) {
        return true;
    }

    const bool from_layer_1 = layer_switch_get_layer(record->event.key) == SENTENCE_END_LAYER;
    const bool in_progress  = sentence_end_token != INVALID_DEFERRED_TOKEN || sentence_end_tap_kc != KC_NO;
    if (!from_layer_1 && !in_progress) {
        return true;
    }

    if (!record->event.pressed) {
        if (sentence_end_token == INVALID_DEFERRED_TOKEN && sentence_end_tap_kc != KC_NO) {
            sentence_end_token = defer_exec(SENTENCE_DOUBLE_TAP_TERM, sentence_end_single_tap, NULL);
        }
        return false;
    }

    if (sentence_end_token != INVALID_DEFERRED_TOKEN) {
        cancel_deferred_exec(sentence_end_token);
        sentence_end_token  = INVALID_DEFERRED_TOKEN;
        sentence_end_tap_kc = KC_NO;
        send_sentence_end(false);
        return false;
    }

    sentence_end_tap_kc = sentence_end_unwrap(keycode);
    return false;
}

// Oryx 0/50 is the same switch as Space tap / Shift hold. The first tap and
// any hold still go to Oryx unchanged; only a second tap (already decided as
// a tap, the same as typing two spaces) is rewritten to ". " + one-shot Shift.
static bool process_base_sentence_end_tap(uint16_t keycode, keyrecord_t *record) {
    (void)keycode;
    const bool is_key = is_sentence_end_switch(record) &&
                        layer_switch_get_layer(record->event.key) == 0;

    if (!record->event.pressed) {
        if (is_key && sentence_space_skip_release) {
            sentence_space_skip_release = false;
            return false;
        }
        return true;
    }

    if (!is_key) {
        sentence_space_tapped = false;
        return true;
    }

    if (record->tap.count == 0) {
        sentence_space_tapped = false;
        return true;
    }

    if (sentence_space_tapped &&
        timer_elapsed(sentence_space_tap_time) < SENTENCE_DOUBLE_TAP_TERM) {
        sentence_space_tapped       = false;
        sentence_space_skip_release = true;
        send_sentence_end(true);
        return false;
    }

    sentence_space_tapped   = true;
    sentence_space_tap_time = timer_read();
    return true;
}

static uint16_t sentence_tap_letter(uint16_t keycode) {
    const uint16_t tap_kc = sentence_end_unwrap(keycode);
    if (tap_kc >= KC_A && tap_kc <= KC_Z) return tap_kc;
    return KC_NO;
}

static bool is_apostrophe_tap(uint16_t keycode, keyrecord_t *record) {
    if (IS_QK_MOD_TAP(keycode) && record->tap.count == 0) return false;
    return sentence_end_unwrap(keycode) == KC_QUOTE;
}

static void pronoun_type_im(void) {
    tap_code(KC_BSPC);
    tap_code(KC_QUOTE);
    tap_code(KC_M);
}

static void pronoun_undo_i(void) {
    tap_code(KC_BSPC);
    tap_code(KC_I);
}

static void pronoun_undo_im(void) {
    tap_code(KC_BSPC);
    tap_code(KC_BSPC);
    tap_code(KC_I);
    tap_code(KC_M);
}

// After a Space tap, treat a lone "i" as "I". "I'm" keeps the capital even when
// quote is a shift mod-tap and m lands first. Other letters undo the capital
// so it/in/if/image stay lowercase. Not used right after ". ".
static bool process_pronoun_i(uint16_t keycode, keyrecord_t *record) {
    if (!record->event.pressed) return true;

    if ((get_mods() & ~MOD_MASK_SHIFT) != 0) {
        sentence_after_space   = false;
        sentence_start_pending = false;
        pronoun_state          = PRONOUN_NONE;
        return true;
    }

    const uint16_t letter = sentence_tap_letter(keycode);
    const uint16_t tap_kc = sentence_end_unwrap(keycode);

    if (sentence_start_pending) {
        if (letter != KC_NO || tap_kc == KC_SPC) {
            sentence_start_pending = false;
        }
        return true;
    }

    if (pronoun_state == PRONOUN_I) {
        if (is_apostrophe_tap(keycode, record)) {
            pronoun_state = PRONOUN_APOS;
            return true;
        }
        if (letter == KC_M) {
            pronoun_state = PRONOUN_IM;
            return true;
        }
        if (letter != KC_NO) {
            pronoun_undo_i();
        }
        pronoun_state = PRONOUN_NONE;
        if (tap_kc == KC_SPC) sentence_after_space = true;
        return true;
    }

    if (pronoun_state == PRONOUN_IM) {
        if (is_apostrophe_tap(keycode, record)) {
            pronoun_type_im();
            pronoun_state = PRONOUN_NONE;
            return false;
        }
        if (letter != KC_NO) {
            pronoun_undo_im();
            pronoun_state = PRONOUN_NONE;
            return true;
        }
        pronoun_undo_im();
        pronoun_state = PRONOUN_NONE;
        if (tap_kc == KC_SPC) sentence_after_space = true;
        return true;
    }

    if (pronoun_state == PRONOUN_APOS) {
        pronoun_state = PRONOUN_NONE;
        if (tap_kc == KC_SPC) sentence_after_space = true;
        return true;
    }

    if (tap_kc == KC_SPC) {
        sentence_after_space = true;
        return true;
    }

    if (sentence_after_space && letter == KC_I) {
        sentence_after_space = false;
        if ((get_mods() & MOD_MASK_SHIFT) == 0) {
            pronoun_state = PRONOUN_I;
            set_oneshot_mods(MOD_BIT(KC_LSFT));
        }
        return true;
    }

    sentence_after_space = false;
    return true;
}

// Oryx 0/25 left thumb outer (Ctrl hold / Enter tap), 0/51 right thumb outer
// (layer 2 hold / Backspace tap). Hold 0/25 then tap 0/51 deletes the current
// line; double-tap 0/51 deletes the previous word. A single tap and a hold on
// either key stay with Oryx.
#define WORD_DEL_HOLD_ROW 5
#define WORD_DEL_HOLD_COL 1
#define WORD_DEL_TAP_ROW  11
#define WORD_DEL_TAP_COL  6

static bool word_del_mod_held      = false;
static bool word_del_skip_release  = false;
static bool word_del_tapped        = false;
static uint16_t word_del_tap_time  = 0;

static bool host_is_apple(void) {
    switch (detected_host_os()) {
        case OS_WINDOWS:
        case OS_LINUX:
            return false;
        case OS_MACOS:
        case OS_IOS:
            return true;
        default:
            return keymap_config.swap_lctl_lgui;
    }
}

static void send_word_delete(void) {
    const uint8_t mods = get_mods();
    clear_mods();
    send_keyboard_report();
    tap_code16(host_is_apple() ? LALT(KC_BSPC) : LCTL(KC_BSPC));
    set_mods(mods);
    send_keyboard_report();
}

static void send_line_delete(void) {
    const uint8_t mods = get_mods();
    clear_mods();
    send_keyboard_report();
    if (host_is_apple()) {
        tap_code16(LGUI(KC_LEFT));
        tap_code16(LSFT(LGUI(KC_RGHT)));
    } else {
        tap_code(KC_HOME);
        tap_code16(LSFT(KC_END));
    }
    tap_code(KC_BSPC);
    set_mods(mods);
    send_keyboard_report();
}

static bool process_word_delete_chord(uint16_t keycode, keyrecord_t *record) {
    const uint8_t row = record->event.key.row;
    const uint8_t col = record->event.key.col;

    if (row == WORD_DEL_HOLD_ROW && col == WORD_DEL_HOLD_COL) {
        if (!record->event.pressed) {
            word_del_mod_held = false;
            return true;
        }
        word_del_mod_held = IS_QK_MOD_TAP(keycode) && record->tap.count == 0;
        return true;
    }

    if (row != WORD_DEL_TAP_ROW || col != WORD_DEL_TAP_COL) {
        if (record->event.pressed) word_del_tapped = false;
        return true;
    }

    if (!record->event.pressed) {
        if (word_del_skip_release) {
            word_del_skip_release = false;
            return false;
        }
        return true;
    }

    if (IS_QK_LAYER_TAP(keycode) && record->tap.count == 0) {
        word_del_tapped = false;
        return true;
    }

    if (word_del_mod_held) {
        word_del_tapped       = false;
        word_del_skip_release = true;
        send_line_delete();
        return false;
    }

    if (word_del_tapped && timer_elapsed(word_del_tap_time) < SENTENCE_DOUBLE_TAP_TERM) {
        word_del_tapped       = false;
        word_del_skip_release = true;
        send_word_delete();
        return false;
    }

    word_del_tapped   = true;
    word_del_tap_time = timer_read();
    return true;
}

// Oryx owns process_record_user() and get_tapping_term() in the export;
// modifyFirmware.js renames them to oryx_export_* so these wrappers can front
// them. The prefix is deliberately not an _oryx suffix: QMK generates a weak
// hook named after each community module, and ZSA ships an oryx one, so
// process_record_oryx() is already called by process_record_modules() on every
// key event -- defining it here would run the export's macro switch twice.
bool process_record_user(uint16_t keycode, keyrecord_t *record) {
    if (!process_sentence_end_key(keycode, record)) {
        return false;
    }
    if (!process_base_sentence_end_tap(keycode, record)) {
        return false;
    }
    if (!process_pronoun_i(keycode, record)) {
        return false;
    }
    if (!process_word_delete_chord(keycode, record)) {
        return false;
    }
    apply_same_hand_shift_guard(keycode, record);
    return oryx_export_process_record(keycode, record);
}

uint16_t get_tapping_term(uint16_t keycode, keyrecord_t *record) {
    if (!is_sentence_end_switch(record) &&
        is_shift_mod_tap(keycode) &&
        (shift_out_of_flow_hands & hand_bit_of_event(record->event)) != 0) {
        return SHIFT_OUT_OF_FLOW_HOLD_TERM;
    }
    return oryx_export_get_tapping_term(keycode, record);
}

`

}
