# Interpreter Overlay — Design Spec

## Goal

Replace Sunny's current interpreter mode (pair picker → activity screen) with a dedicated fullscreen overlay that matches the Smart Salon Agent's voice interface: flat state machine, fast mic→translate→speak pipeline, no dead-time guards.

## Approach

New self-contained component `src/components/InterpreterOverlay.jsx`. All interpreter logic moves out of `App.jsx`. The overlay is triggered by the existing interpreter button, which now simply sets `interpreterOpen = true`.

## Languages

Four pairs, English always on one side:

| Pair | Strip label |
|------|-------------|
| Vietnamese ↔ English | VI |
| Spanish ↔ English | ES |
| Japanese ↔ English | JA |
| Korean ↔ English | KO |

---

## Layout

Full-viewport dark modal (`rgba(10, 22, 44, 0.97)`).

```
┌─────────────────────────────────┐
│  [✕]                            │
│                                 │
│   Vietnamese ↔ English   [⇄]   │  ← pair label + swap button
│                                 │
│   ┌─ waveform ─────────────┐   │
│   │  ▁ ▃ █ ▃ ▁             │   │  ← 5 CSS bars
│   └─────────────────────────┘   │
│                                 │
│   Listening…                    │  ← state label (aria-live)
│                                 │
│   "xin chào bạn"                │  ← transcript
│   → Hello, how are you?         │  ← translation
│                                 │
│  [VI]  [ES]  [JA]  [KO]        │  ← language strip
└─────────────────────────────────┘
```

**Waveform behaviour by state:**

| State | Bar animation |
|-------|--------------|
| `idle` | Static, short |
| `listening` | Oscillating, random heights |
| `processing` | Flat, slow pulse |
| `speaking` | Slow wave |
| `error` | Flat |

CSS-driven via `data-state` attribute on the overlay root — no JS animation loops.

**State label strings:**

| State | EN label |
|-------|----------|
| `idle` | Ready — tap a language |
| `listening` | Listening… |
| `processing` | Translating… |
| `speaking` | Speaking… |
| `error` | Tap to retry |

---

## State Machine

Single React state variable: `const [state, setState] = useState('idle')`.

```
idle
 └─(user taps language strip)──→ listening (fromLang turn)
                                      │
                               STT onresult (final)
                                      │
                                      ↓
                                 processing
                                      │
                              Claude API response
                                      │
                                      ↓
                                  speaking
                                      │
                              TTS onended + 400ms
                                      │
                                      ↓
                               listening (toLang turn, flipped)
                                      │
                                   (repeat)
```

**Turn tracking** (two `useRef` values, not state — no re-renders):
- `fromLangRef` — the non-English language (vi / es / ja / ko)
- `currentTurnRef` — `'from'` (foreign lang) or `'to'` (English)

**Interruption:** tapping the waveform/mic area during `speaking` calls `stopTTS()` then immediately transitions to `listening`.

**Error recovery:** any API failure or TTS error sets state to `error` with a 3s auto-reset to `idle`. No deadlocks — no boolean mutex.

---

## STT Pipeline

- `continuous: false` — browser detects natural speech end, no silence timer needed
- `interimResults: false` — final results only, no fragment processing or premature API calls
- Fresh `SpeechRecognition` instance per turn

**STT locales per turn:**

| Pair | `'from'` turn | `'to'` turn |
|------|--------------|-------------|
| VI ↔ EN | `vi-VN` | `vi-VN` (Vietnamese STT detects English) |
| ES ↔ EN | `es-ES` | `en-US` |
| JA ↔ EN | `ja-JP` | `en-US` |
| KO ↔ EN | `ko-KR` | `en-US` |

---

## Translation API

Single `POST /api/chat` call per turn. Tight, stateless prompt:

```
System: "You are a live interpreter. The user will say something in {sourceLang}.
Translate it to {targetLang}. Output only the translation — no explanations,
no labels, no punctuation changes beyond what's natural."

User: "{transcript}"
```

- `max_tokens: 300`
- No conversation history (each turn is independent)
- `sourceLang` and `targetLang` are full language names (e.g. "Vietnamese", "English")

---

## TTS Pipeline

Three-tier fallback, same proxy chain as the rest of the app. Props passed in from `App.jsx`:

```
speakViaOpenAI(text, onDone)   → POST /api/tts-openai (nova)
  ↓ fails
speakViaGemini(text, lang, onDone)  → POST /api/tts (Sulafat EN / Aoede VI·ES·JA·KO)
  ↓ fails
speak(text, onDone, langOverride)   → browser SpeechSynthesis
```

**TTS language per turn:**
- `'from'` turn → speak in English (`en`)
- `'to'` turn → speak in `fromLang` (vi / es / ja / ko)

**Timing:**
- 100ms echo buffer after TTS ends (hardware speaker bleed clears in <100ms)
- 400ms conversational pause after buffer (down from salon agent's 700ms)
- Total post-speech gap before mic restarts: **500ms**

**iOS keepalive:** during browser TTS fallback, `setInterval(pause/resume, 10000)` prevents iOS Safari 14s cutoff.

---

## Integration with App.jsx

**Added:**
```jsx
const [interpreterOpen, setInterpreterOpen] = useState(false);

// existing interpreter button:
onClick={() => setInterpreterOpen(true)}

// at bottom of JSX tree:
<InterpreterOverlay
  open={interpreterOpen}
  onClose={() => setInterpreterOpen(false)}
  speakViaOpenAI={speakViaOpenAI}
  speakViaGemini={speakViaGemini}
  speak={speak}
/>
```

**Removed from App.jsx:**
- `showInterpreterPicker` state + picker UI
- `startInterpreterWithPair()` function
- `startInterpreterListening()` function
- `swapInterpreterDirection()` function
- `isInterpreterModeRef`, `interpreterGuardActiveRef`, `interpreterTurnRef`, `activePairRef`
- All `isInterpreterModeRef.current` branches in the STT `onresult` handler
- Interpreter-specific branches in the TTS `onended` handler
- The `smartModeIntentRef` interpreter path in `startActivityWithTopic()`

**`INTERPRETER_QUICK_PAIRS`** constant stays in `languageEngine.js` — imported by the overlay.

---

## File Changes

| File | Change |
|------|--------|
| `src/components/InterpreterOverlay.jsx` | **New** — ~280 lines, fully self-contained |
| `src/App.jsx` | Remove ~150 lines of interpreter logic; add `interpreterOpen` state + overlay render |

No new dependencies. No new API routes.

---

## Latency Comparison

| Metric | Before | After |
|--------|--------|-------|
| Startup guard | 1200ms | 0ms (none needed) |
| Post-speech guard | 1000ms | 500ms (100ms buffer + 400ms pause) |
| STT strategy | Continuous + 800ms silence timer + interim | `continuous:false`, final only |
| TTS fallback | Single path (falls through slowly) | 3-tier, instant browser fallback |
| iOS dead-time | Up to 8s | Keepalive eliminates this |
| **Per-turn savings** | — | **~800–1700ms** |
