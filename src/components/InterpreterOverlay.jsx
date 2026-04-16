// src/components/InterpreterOverlay.jsx
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './InterpreterOverlay.css';
import {
  buildInterpreterPrompt,
  parseInterpreterResponse,
  resolveDirection,
  runInterpreterTts,
  buildGeminiProvider,
  VI_GEMINI_VOICES,
} from '../utils/interpreterBrain.js';

const PAIRS = [
  { code: 'vi', label: 'VI', name: 'Vietnamese', flag: '🇻🇳', sttLocale: 'vi-VN' },
  { code: 'es', label: 'ES', name: 'Spanish',    flag: '🇪🇸', sttLocale: 'es-ES' },
  { code: 'ja', label: 'JA', name: 'Japanese',   flag: '🇯🇵', sttLocale: 'ja-JP' },
  { code: 'ko', label: 'KO', name: 'Korean',     flag: '🇰🇷', sttLocale: 'ko-KR' },
];

// TTS safety timeout — if audio never fires `onended` (AudioContext suspend, iOS background),
// force the turn to advance so the interpreter doesn't hang forever.
const TTS_SAFETY_MS = 30_000;

export default function InterpreterOverlay({
  open,
  onClose,
  speakViaOpenAI,
  speakViaGemini,
  speak,                // browser SpeechSynthesis fallback — must be passed from App.jsx
  stopCurrentAudio,     // stops Web Audio API + browser synthesis — must be passed from App.jsx
  dialect,
  viGeminiVoice = 'Aoede',         // pinned Gemini voice for Vietnamese output
  onViGeminiVoiceChange,           // (voiceName: string) => void — called when user changes voice
}) {
  const [state,       setState]       = useState('idle');
  const [activePair,  setActivePair]  = useState(null);
  const [transcript,  setTranscript]  = useState('');
  const [translation, setTranslation] = useState('');
  const [errorMsg,    setErrorMsg]    = useState('');

  const recRef            = useRef(null);   // active SpeechRecognition
  const abortRef          = useRef(null);   // AbortController for the translation fetch
  const errorTimerRef     = useRef(null);   // timeout for auto-clearing errors
  const ttsSafetyTimerRef = useRef(null);   // safety timeout against TTS that never fires onended
  const isMounted         = useRef(true);
  const nextLocaleRef     = useRef(null);   // STT locale for the NEXT listen cycle (set from resolveDirection)
  const contextRef        = useRef([]);     // rolling conversation history (last 6 messages)

  // ── Turn tracking ──────────────────────────────────────────────────────────
  // turnIdRef is a monotonically-increasing counter.
  // Each _translate call increments it and captures `thisTurnId`.
  // _stopAll also increments it, invalidating any pending callbacks from the
  // current turn so they cannot fire after the session is reset.
  const sessionIdRef = useRef(null);  // unique ID per selected-pair session (for debug logs)
  const turnIdRef    = useRef(0);     // turn counter; guards stale onTtsDone callbacks

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; _stopAll(); };
  }, []);

  useEffect(() => {
    if (!open) {
      _stopAll();
      setState('idle');
      setActivePair(null);
      setTranscript('');
      setTranslation('');
      setErrorMsg('');
      contextRef.current    = [];
      nextLocaleRef.current = null;
      sessionIdRef.current  = null;
    }
  }, [open]);

  // ── Debug logging ──────────────────────────────────────────────────────────
  // Open the browser console and filter by "[Interpreter]" to watch per-turn decisions.
  function _log(phase, info) {
    console.log(
      `[Interpreter][${sessionIdRef.current || 'no-session'}][T${turnIdRef.current}][${phase}]`,
      info
    );
  }

  // ── Lifecycle helpers ──────────────────────────────────────────────────────
  function _stopAll() {
    // Increment turnId — invalidates any onTtsDone closure from the current turn
    turnIdRef.current++;

    if (recRef.current) {
      const rec = recRef.current;
      recRef.current = null;
      try { rec.abort(); } catch (_) {}
    }
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }

    // Stop any playing audio (Web Audio API source + browser synthesis)
    if (stopCurrentAudio) stopCurrentAudio();

    clearTimeout(ttsSafetyTimerRef.current);
    clearTimeout(errorTimerRef.current);
  }

  function _setError(msg) {
    if (!isMounted.current) return;
    setState('error');
    setErrorMsg(msg);
    clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      if (isMounted.current) { setState('idle'); setErrorMsg(''); }
    }, 3000);
  }

  // ── STT ────────────────────────────────────────────────────────────────────
  // sttLocale comes from nextLocaleRef (set by resolveDirection after each turn):
  //   - First turn and all low-confidence turns: pair.sttLocale (cascade-collapse prevention)
  //   - High-confidence English detection: en-US (cleaner STT for the English speaker)
  //   - High-confidence foreign detection: pair.sttLocale
  // Both speakers can speak any language in any order, including consecutive same-language
  // turns. Foreign speech is captured cleanly. English through a foreign-locale STT is
  // transcribed phonetically; the AI prompt and detectLangFromText fallback both handle it.
  function _startListening(pair, sttLocale) {
    if (!isMounted.current || !open) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { _setError('Speech recognition unavailable'); return; }

    if (recRef.current) {
      const old = recRef.current;
      recRef.current = null;
      try { old.abort(); } catch (_) {}
    }

    const rec = new SR();
    rec.lang            = sttLocale;
    rec.continuous      = false;
    rec.interimResults  = true;
    rec.maxAlternatives = 3;

    _log('STT_START', { sttLocale });

    rec.onresult = (e) => {
      if (!isMounted.current) return;
      const lastResult = e.results[e.results.length - 1];
      if (!lastResult.isFinal) {
        const partial = lastResult[0].transcript.trim();
        if (partial) setTranscript(partial + '…');
        return;
      }
      let best = lastResult[0];
      for (let i = 1; i < lastResult.length; i++) {
        if ((lastResult[i].confidence || 0) > (best.confidence || 0)) best = lastResult[i];
      }
      const text = best.transcript.trim();
      if (!text || text.length < 2) return;

      _log('STT_RESULT', { sttLocale, text, confidence: best.confidence });

      recRef.current = null;
      setTranscript(text);
      setTranslation('');
      setState('processing');
      _translate(text, pair, sttLocale);
    };

    rec.onerror = (e) => {
      recRef.current = null;
      if (e.error === 'no-speech') {
        if (isMounted.current && open) _startListening(pair, sttLocale);
      } else if (e.error === 'aborted') {
        // intentional
      } else if (e.error === 'language-not-supported') {
        _setError(`${pair.name} STT not enabled — Settings → General → Keyboard → add ${pair.name}`);
      } else if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        _setError('Microphone access denied');
      } else {
        _setError('Microphone error — tap to retry');
      }
    };

    rec.onend = () => {
      if (recRef.current === rec) {
        recRef.current = null;
        if (isMounted.current && open) {
          setTimeout(() => { if (isMounted.current && open) _startListening(pair, sttLocale); }, 500);
        }
      }
    };

    recRef.current = rec;
    try { rec.start(); setState('listening'); }
    catch (_) { recRef.current = null; _setError('Could not start microphone'); }
  }

  // ── Translation + TTS ─────────────────────────────────────────────────────
  async function _translate(text, pair, sttLocale) {
    // Capture turn ID at start — used to detect stale callbacks if _stopAll fires mid-turn
    const thisTurnId = ++turnIdRef.current;

    const systemPrompt = buildInterpreterPrompt(pair, dialect);
    // Each interpreter turn is fully independent — no conversation history is sent.
    // Rolling context was causing the AI to infer alternating direction from the
    // accumulated user:Vi → assistant:En pattern, reintroducing the alternating-turn bug.
    // Detection must come from the current message ONLY, not from prior turn patterns.
    const messages = [
      { role: 'user', content: text },
    ];

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages, system: systemPrompt, maxTokens: 200 }),
        signal:  ctrl.signal,
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const rawResponse = (data.content?.[0]?.text || '').trim();
      if (!rawResponse) throw new Error('Empty response');

      if (!isMounted.current) return;
      abortRef.current = null;

      // ── Per-turn language detection + direction resolution ─────────────────
      // Pass `text` (the user's transcript), not sttLocale — parseInterpreterResponse
      // uses detectLangFromText(transcript, pair) as its stateless fallback.
      const { detected, translation: translated, confidence } =
        parseInterpreterResponse(rawResponse, pair, text);

      const { ttsLang, nextLocale } = resolveDirection(detected, pair);
      nextLocaleRef.current = nextLocale;

      // Determine effective Gemini voice for this turn:
      // - Vietnamese output → user-selected viGeminiVoice (pinned, never re-resolved)
      // - English output    → server default Sulafat (not overridden)
      const effectiveVoice = ttsLang === pair.code ? viGeminiVoice : 'Sulafat (server default)';

      _log('TRANSLATE', {
        pair:                `${pair.name} ↔ English`,
        transcript:          text,
        sttLocaleUsed:       sttLocale,
        detected,
        detectionConfidence: confidence,
        outputLang:          ttsLang,
        direction:           `${detected === 'en' ? 'English' : pair.name} → ${ttsLang === 'en' ? 'English' : pair.name}`,
        nextSTTLocale:       nextLocale,
        localeChanged:       nextLocale !== sttLocale,   // true when en-US replaces pair.sttLocale
        effectiveGeminiVoice: effectiveVoice,
        voicePinned:         ttsLang === pair.code,
        priorContextSent:    0,              // always 0 — each turn is stateless, no history
        expectedNextLanguageLogicUsed: false, // confirmed: no expectedNextLanguage state
        translatedSnippet:   translated.slice(0, 120),
        rawAIResponse:       rawResponse,
      });

      // Guard: if _stopAll fired while awaiting translation, bail here
      if (turnIdRef.current !== thisTurnId) {
        _log('TRANSLATE_ABORT', { reason: 'turn invalidated during fetch' });
        return;
      }

      setTranslation(translated);
      setState('speaking');

      // ── Build a once-only, stale-guarded TTS completion handler ───────────
      // - Fires at most once (ttsCallCompleted flag)
      // - Bails if _stopAll incremented turnIdRef (stale turn)
      // - Cleared by ttsSafetyTimerRef if audio never fires onended
      let ttsCallCompleted = false;

      const onTtsDone = () => {
        clearTimeout(ttsSafetyTimerRef.current);

        if (turnIdRef.current !== thisTurnId) {
          _log('TTS_DONE_STALE', { expected: thisTurnId, current: turnIdRef.current });
          return;
        }
        if (ttsCallCompleted) {
          _log('TTS_DONE_DUPLICATE', { thisTurnId });
          return;
        }
        ttsCallCompleted = true;

        _log('TTS_DONE', { thisTurnId, nextSTTLocale: nextLocale });

        if (!isMounted.current || !open) return;
        setTimeout(() => {
          if (!isMounted.current || !open) return;
          _startListening(pair, nextLocale);
        }, 500);
      };

      // Safety timeout: if TTS never fires onended (AudioContext suspend, iOS background),
      // force advance after TTS_SAFETY_MS so interpreter doesn't hang indefinitely.
      clearTimeout(ttsSafetyTimerRef.current);
      ttsSafetyTimerRef.current = setTimeout(() => {
        _log('TTS_SAFETY_TIMEOUT', { thisTurnId, ttsLang, translated: translated.slice(0, 80) });
        onTtsDone();
      }, TTS_SAFETY_MS);

      _log('TTS_START', {
        thisTurnId,
        ttsLang,
        voice: ttsLang === 'en' ? 'Sulafat→nova→browser' : `${viGeminiVoice}→browser`,
        textLen: translated.length,
      });

      // ── TTS cascade ────────────────────────────────────────────────────────
      // English:     Gemini (Sulafat) → OpenAI (nova) → browser SpeechSynthesis
      // Non-English: Gemini (user-selected voice, pinned) → browser SpeechSynthesis
      //
      // buildGeminiProvider wraps speakViaGemini with the user's pinned voice
      // preference so the same voice is used on every Vietnamese-output turn.
      // The voice name travels: here → speakViaGemini 4th arg → /api/tts body.voice
      // → Gemini API voiceName. No re-resolution happens anywhere in the chain.
      const pinnedGemini = buildGeminiProvider(speakViaGemini, { [pair.code]: viGeminiVoice });
      runInterpreterTts(translated, ttsLang, {
        gemini:  pinnedGemini,
        openai:  speakViaOpenAI,
        browser: speak,
      }, onTtsDone);

    } catch (e) {
      clearTimeout(ttsSafetyTimerRef.current);
      if (e.name === 'AbortError') return;
      if (!isMounted.current) return;
      _log('TRANSLATE_ERROR', { error: e.message });
      _setError((e.message?.length < 60 ? e.message : 'Translation failed') + ' — tap to retry');
    }
  }

  // ── Controls ───────────────────────────────────────────────────────────────
  function handleSelectPair(pair) {
    if (state === 'processing') return;
    _stopAll();
    sessionIdRef.current = `s${Date.now()}`;  // fresh session ID for debug logs
    setActivePair(pair);
    setTranscript('');
    setTranslation('');
    setErrorMsg('');
    contextRef.current   = [];
    nextLocaleRef.current = pair.sttLocale;

    _log('SESSION_START', { pair: `${pair.name} ↔ English`, sttLocale: pair.sttLocale });
    _startListening(pair, pair.sttLocale);
  }

  function handleMicTap() {
    if (!activePair) return;
    const loc = nextLocaleRef.current ?? activePair.sttLocale;
    if (state === 'speaking') {
      _stopAll();
      setState('idle');
      // Audio was stopped; restart listening immediately
      if (isMounted.current && open) _startListening(activePair, loc);
    } else if (state === 'listening') {
      _stopAll();
      setState('idle');
    } else if (state === 'idle' || state === 'error') {
      setErrorMsg('');
      _startListening(activePair, loc);
    }
  }

  function handleClose() { _stopAll(); onClose(); }

  if (!open) return null;

  const isVI = activePair?.code === 'vi';
  const STATE_LABELS = {
    idle:       activePair ? (isVI ? 'NHẤN ĐỂ NÓI' : 'TAP TO SPEAK') : (isVI ? 'CHỌN NGÔN NGỮ' : 'SELECT LANGUAGE'),
    listening:  isVI ? 'ĐANG NGHE...' : 'LISTENING...',
    processing: isVI ? 'ĐANG DỊCH...' : 'TRANSLATING...',
    speaking:   isVI ? 'ĐANG NÓI...'  : 'SPEAKING...',
    error:      (errorMsg || (isVI ? 'Thử lại' : 'TAP TO RETRY')).toUpperCase(),
  };

  const overlay = (
    <div className="interp-overlay" data-state={state}>

      <div className="interp-topbar">
        <span className="interp-mode-label">VOICE ASSISTANT</span>
        <button className="interp-close" onClick={handleClose} aria-label="Close">✕</button>
      </div>

      <div className="interp-agent-name">
        {activePair && <span className="interp-flag">{activePair.flag}</span>}
        <span>{activePair ? activePair.name : 'Sunny'}</span>
      </div>

      <div className="interp-center">
        {translation && <div className="interp-translation">{translation}</div>}
        {transcript  && <div className="interp-transcript">"{transcript}"</div>}
      </div>

      <div className="interp-controls">
        <div className="interp-status-label" aria-live="polite">{STATE_LABELS[state]}</div>
        <button
          className="interp-mic-area"
          onClick={handleMicTap}
          aria-label={state === 'listening' ? 'Stop' : 'Speak'}
        >
          <div className="interp-wave" aria-hidden="true">
            <span /><span /><span /><span /><span />
          </div>
        </button>
      </div>

      {/* Vietnamese voice selector — only visible when VI pair is active */}
      {activePair?.code === 'vi' && (
        <div className="interp-voice-strip">
          {VI_GEMINI_VOICES.map(v => (
            <button
              key={v.name}
              className={`interp-voice-btn${viGeminiVoice === v.name ? ' interp-voice-btn--active' : ''}`}
              onClick={() => onViGeminiVoiceChange?.(v.name)}
              title={`${v.description} (${v.gender})`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      <div className="interp-lang-strip">
        {PAIRS.map(p => (
          <button
            key={p.code}
            className={`interp-lang-btn${activePair?.code === p.code ? ' interp-lang-btn--active' : ''}`}
            onClick={() => handleSelectPair(p)}
          >
            {p.label}
          </button>
        ))}
      </div>

    </div>
  );

  return ReactDOM.createPortal(overlay, document.body);
}
