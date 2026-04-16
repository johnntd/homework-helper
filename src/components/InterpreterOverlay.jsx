// src/components/InterpreterOverlay.jsx
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './InterpreterOverlay.css';

// 4 language pairs — English is always on one side.
const PAIRS = [
  { code: 'vi', label: 'VI', name: 'Vietnamese', flag: '🇻🇳', sttLocale: 'vi-VN' },
  { code: 'es', label: 'ES', name: 'Spanish',    flag: '🇪🇸', sttLocale: 'es-ES' },
  { code: 'ja', label: 'JA', name: 'Japanese',   flag: '🇯🇵', sttLocale: 'ja-JP' },
  { code: 'ko', label: 'KO', name: 'Korean',     flag: '🇰🇷', sttLocale: 'ko-KR' },
];

// STT locale for a given turn.
// 'from' = foreign-language turn → use the pair's locale.
// 'to'   = English turn         → always use en-US so English speech is reliably captured.
// Each locale only recognises its own language reliably on iOS Safari.
function getSttLocale(pair, turn) {
  return turn === 'from' ? pair.sttLocale : 'en-US';
}

// TTS lang code for the output on a given turn.
// 'from' turn: user spoke in foreign lang → output is English.
// 'to' turn: user spoke in English → output is foreign lang.
function getTtsLang(pair, turn) {
  return turn === 'from' ? 'en' : pair.code;
}

// Source / target language names for the translation prompt.
function getTranslationLangs(pair, turn) {
  return turn === 'from'
    ? { source: pair.name, target: 'English' }
    : { source: 'English', target: pair.name };
}

// Next turn after the current one completes.
function nextTurn(turn) {
  return turn === 'from' ? 'to' : 'from';
}

export default function InterpreterOverlay({ open, onClose, speakViaOpenAI, speakViaGemini, speak }) {
  const [state,       setState]       = useState('idle');
  const [activePair,  setActivePair]  = useState(null);
  const [transcript,  setTranscript]  = useState('');
  const [translation, setTranslation] = useState('');
  const [errorMsg,    setErrorMsg]    = useState('');

  // Refs — stable across renders, no re-renders needed
  const turnRef       = useRef('from');   // current turn direction
  const recRef        = useRef(null);     // active SpeechRecognition instance
  const abortRef      = useRef(null);     // AbortController for in-flight /api/chat
  const keepaliveRef  = useRef(null);     // iOS TTS keepalive interval
  const errorTimerRef = useRef(null);     // auto-reset from error
  const isMounted     = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      _stopAll();
    };
  }, []);

  // Reset when overlay closes
  useEffect(() => {
    if (!open) {
      _stopAll();
      setState('idle');
      setActivePair(null);
      setTranscript('');
      setTranslation('');
      setErrorMsg('');
    }
  }, [open]);

  // ── Internal helpers ────────────────────────────────────────────────────────

  function _stopAll() {
    // Stop STT — null the ref BEFORE abort so that the onend handler
    // (which may fire synchronously on iOS) sees null and won't restart.
    if (recRef.current) {
      const rec = recRef.current;
      recRef.current = null;
      try { rec.abort(); } catch (_) {}
    }
    // Cancel in-flight translation
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    clearInterval(keepaliveRef.current);
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

  function _startListening(pair, turn) {
    if (!isMounted.current || !open) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { _setError('Speech recognition unavailable'); return; }

    // Stop any previous recognition instance cleanly — null before abort
    // so the onend handler on the old rec won't restart.
    if (recRef.current) {
      const oldRec = recRef.current;
      recRef.current = null;
      try { oldRec.abort(); } catch (_) {}
    }

    const rec = new SR();
    rec.lang            = getSttLocale(pair, turn);
    rec.continuous      = false;   // browser auto-detects end of utterance — no silence timer
    rec.interimResults  = false;   // final results only — no fragment submissions
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript?.trim();
      if (!text || !isMounted.current) return;
      recRef.current = null;
      setTranscript(text);
      setTranslation('');
      setState('processing');
      _translate(text, pair, turn);
    };

    rec.onerror = (e) => {
      recRef.current = null;
      if (e.error === 'no-speech') {
        // User paused — just restart listening on the same turn
        if (isMounted.current && open) _startListening(pair, turn);
      } else if (e.error === 'aborted') {
        // Intentional abort (e.g. user tapped mic to stop) — do nothing
      } else {
        _setError('Microphone error');
      }
    };

    // iOS Safari fires onend without onresult when the engine silently terminates
    // (permission revoked mid-session, internal timeout, etc.). If this instance
    // is still the active recognizer, restart after a 250ms gap so we don't
    // flood the browser with rapid back-to-back start() calls.
    rec.onend = () => {
      if (recRef.current === rec) {
        recRef.current = null;
        if (isMounted.current && open) {
          setTimeout(() => {
            if (isMounted.current && open) _startListening(pair, turn);
          }, 250);
        }
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      setState('listening');
    } catch (e) {
      recRef.current = null;
      _setError('Could not start microphone');
    }
  }

  async function _translate(text, pair, turn) {
    const { source, target } = getTranslationLangs(pair, turn);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages:  [{ role: 'user', content: text }],
          system:    `You are a live interpreter. Translate the following from ${source} to ${target}. Output only the translation — no explanations, no labels, nothing else.`,
          maxTokens: 300,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const translated = data.content?.[0]?.text?.trim() || '';
      if (!translated) throw new Error('Empty response from server');

      if (!isMounted.current) return;
      abortRef.current = null;

      setTranslation(translated);
      setState('speaking');

      const ttsLang = getTtsLang(pair, turn);
      const theNextTurn = nextTurn(turn);

      // Called by whichever TTS tier completes first
      const onTtsDone = () => {
        if (!isMounted.current || !open) return;
        clearInterval(keepaliveRef.current);
        // 100ms echo buffer + 400ms conversational pause = 500ms total
        setTimeout(() => {
          if (!isMounted.current || !open) return;
          turnRef.current = theNextTurn;
          _startListening(pair, theNextTurn);
        }, 500);
      };

      // Three-tier TTS: OpenAI nova → Gemini (Sulafat/Aoede) → browser
      speakViaOpenAI(translated, (ok1) => {
        if (ok1) { onTtsDone(); return; }
        speakViaGemini(translated, ttsLang, (ok2) => {
          if (ok2) { onTtsDone(); return; }
          // Browser TTS with iOS keepalive (prevents ~14s Safari cutoff)
          keepaliveRef.current = setInterval(() => {
            if (window.speechSynthesis?.speaking) {
              window.speechSynthesis.pause();
              window.speechSynthesis.resume();
            } else {
              clearInterval(keepaliveRef.current);
            }
          }, 10000);
          speak(translated, onTtsDone, ttsLang);
        });
      });

    } catch (e) {
      if (e.name === 'AbortError') return; // intentional cancel — do nothing
      if (!isMounted.current) return;
      const msg = e.message && e.message.length < 50 ? e.message : 'Translation failed';
      _setError(msg + ' — tap to retry');
    }
  }

  // ── User interactions ───────────────────────────────────────────────────────

  function handleSelectPair(pair) {
    // Ignore taps during active processing/speaking
    if (state === 'processing') return;
    _stopAll();
    setActivePair(pair);
    setTranscript('');
    setTranslation('');
    setErrorMsg('');
    turnRef.current = 'from';
    _startListening(pair, 'from');
  }

  function handleMicTap() {
    if (!activePair) return;
    if (state === 'speaking') {
      // Interrupt TTS — advance turn and start listening immediately
      _stopAll();
      turnRef.current = nextTurn(turnRef.current);
      _startListening(activePair, turnRef.current);
    } else if (state === 'listening') {
      // Stop listening
      _stopAll();
      setState('idle');
    } else if (state === 'idle' || state === 'error') {
      setErrorMsg('');
      _startListening(activePair, turnRef.current);
    }
  }

  function handleClose() {
    _stopAll();
    onClose();
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!open) return null;

  // Render via portal to document.body so position:fixed escapes any
  // overflow:hidden or transform ancestor in the app tree (iOS Safari bug).

  const STATE_LABELS = {
    idle:       activePair ? 'Tap to speak' : 'Select a language below',
    listening:  'Listening…',
    processing: 'Translating…',
    speaking:   'Speaking…',
    error:      errorMsg || 'Tap to retry',
  };

  const pairLabel = activePair ? `${activePair.name} ↔ English` : 'Live Interpreter';

  const overlay = (
    <div className="interp-overlay" data-state={state}>
      <div className="interp-panel">
        {/* Close */}
        <button className="interp-close" onClick={handleClose} aria-label="Close interpreter">✕</button>

        {/* Pair label */}
        <div className="interp-pair-label">
          {activePair && <span className="interp-flag">{activePair.flag}</span>}
          {pairLabel}
        </div>

        {/* Waveform / mic button */}
        <button
          className="interp-mic-area"
          onClick={handleMicTap}
          aria-label={state === 'listening' ? 'Stop listening' : 'Start listening'}
        >
          <div className="interp-wave" aria-hidden="true">
            <span /><span /><span /><span /><span />
          </div>
        </button>

        {/* State label */}
        <div className="interp-state-label" aria-live="polite">{STATE_LABELS[state]}</div>

        {/* Transcript + translation */}
        {transcript  && <div className="interp-transcript">"{transcript}"</div>}
        {translation && <div className="interp-translation">→ {translation}</div>}

        {/* Language strip */}
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
    </div>
  );

  return ReactDOM.createPortal(overlay, document.body);
}
