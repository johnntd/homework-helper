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

// dialect: 'northern' | 'southern' | 'central' — only meaningful when pair.code === 'vi'
export default function InterpreterOverlay({ open, onClose, speakViaOpenAI, speakViaGemini, speak, dialect }) {
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
  // Rolling context buffer — last 4 utterances (2 exchanges) for coherent interpretation
  const contextRef    = useRef([]);       // [{ role, content }, ...]

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
      contextRef.current = [];
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
    rec.continuous      = false;   // browser auto-detects end of utterance
    rec.interimResults  = true;    // show partial text so user knows they're being heard
    rec.maxAlternatives = 3;       // pick highest-confidence alternative on final

    rec.onresult = (e) => {
      if (!isMounted.current) return;
      const lastResult = e.results[e.results.length - 1];
      const rawText    = lastResult[0].transcript.trim();

      if (!lastResult.isFinal) {
        // Interim — show partial transcript as visual feedback only
        if (rawText) setTranscript(rawText + '…');
        return;
      }

      // Final result: pick the highest-confidence alternative
      let bestAlt = lastResult[0];
      for (let i = 1; i < lastResult.length; i++) {
        if ((lastResult[i].confidence || 0) > (bestAlt.confidence || 0)) bestAlt = lastResult[i];
      }
      const text = bestAlt.transcript.trim();

      // Ignore noise — require at least 2 chars to attempt translation
      if (!text || text.length < 2) return;
      recRef.current = null;
      setTranscript(text);
      setTranslation('');
      setState('processing');
      _translate(text, pair, turn);
    };

    rec.onerror = (e) => {
      recRef.current = null;
      if (e.error === 'no-speech') {
        // User paused — restart on the same turn
        if (isMounted.current && open) _startListening(pair, turn);
      } else if (e.error === 'aborted') {
        // Intentional abort — do nothing
      } else if (e.error === 'language-not-supported') {
        // The device doesn't have this language pack for speech recognition.
        // Guide the user to enable it in Settings.
        _setError(`${pair.name} STT not enabled — go to Settings → General → Keyboard → add ${pair.name}`);
      } else if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        _setError('Microphone access denied');
      } else {
        _setError('Microphone error — tap to retry');
      }
    };

    // iOS Safari fires onend without onresult when the engine silently terminates
    // (permission revoked mid-session, internal timeout, etc.). If this instance
    // is still the active recognizer, restart after a 500ms gap.
    // 500ms (vs the old 250ms) prevents rapid restart loops on iOS.
    rec.onend = () => {
      if (recRef.current === rec) {
        recRef.current = null;
        if (isMounted.current && open) {
          setTimeout(() => {
            if (isMounted.current && open) _startListening(pair, turn);
          }, 500);
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

    // Build language-specific guidance
    let langNote = '';
    if (pair.code === 'vi') {
      const d = dialect || 'southern';
      const dialectDesc =
        d === 'northern' ? 'Northern Vietnamese (Hà Nội) — use tôi/mình, không, Hanoi register.' :
        d === 'central'  ? 'Central Vietnamese (Huế/Đà Nẵng) — use Central expressions and intonation markers.' :
        'Southern Vietnamese (Sài Gòn/HCM) — use bạn/tui/mày/tao as context demands, hông/hổng for negation, dzậy/vậy coloring.';
      langNote = `\n\nVietnamese dialect: ${dialectDesc}
Vietnamese-specific rules:
- Use the right sentence-final particles naturally (à, ạ, nhỉ, nhé, nha, chứ, đấy, vậy).
- Kinship pronouns must match the social relationship and age dynamic exactly.
- Spoken Vietnamese contracts and elides — write how people SPEAK, not textbook prose.
- Preserve Viet-English code-switching if the speaker mixes languages.`;
    } else if (pair.code === 'ko') {
      langNote = '\n\nKorean-specific: Use the appropriate speech level (존댓말/반말) that matches the speaker's register. Preserve sentence-final endings and natural spoken Korean particles.';
    } else if (pair.code === 'ja') {
      langNote = '\n\nJapanese-specific: Match the speech level (keigo/casual) to the register. Use natural spoken Japanese — contractions, sentence-final particles (ね, よ, か), natural rhythm.';
    }

    const systemPrompt =
      `You are a professional simultaneous interpreter with native-level fluency in ${source} and ${target}.${langNote}

Rules:
- Output ONLY the interpreted utterance. No labels, parentheses, or meta-commentary.
- Natural spoken language — never stiff or written-style phrasing.
- Match register (casual/formal/intimate) and emotional tone exactly.
- For short utterances (greetings, yes/no, single concepts) keep the output equally short.
- Preserve filler words and conversational rhythm — don't sanitize natural speech.
- If the speaker code-switches, interpret the dominant intent in the target language.`;

    // Build messages: up to last 4 context utterances + current text
    const messages = [
      ...contextRef.current.slice(-4),
      { role: 'user', content: text },
    ];

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          system:    systemPrompt,
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

      // Append this exchange to the rolling context buffer (max 6 entries = 3 exchanges)
      contextRef.current = [
        ...contextRef.current,
        { role: 'user',      content: text },
        { role: 'assistant', content: translated },
      ].slice(-6);

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

      // TTS routing — language-aware:
      //   English output  → OpenAI nova (best EN quality) → Gemini Sulafat → browser
      //   Foreign output  → Gemini directly (Aoede for VI/ES, Kore for KO/JA)
      //                     OpenAI nova is English-optimised; skipping it for foreign
      //                     languages gives significantly better pronunciation quality.
      const browserFallback = () => {
        keepaliveRef.current = setInterval(() => {
          if (window.speechSynthesis?.speaking) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          } else {
            clearInterval(keepaliveRef.current);
          }
        }, 10000);
        speak(translated, onTtsDone, ttsLang);
      };

      if (ttsLang === 'en') {
        // English: OpenAI nova → Gemini Sulafat → browser
        speakViaOpenAI(translated, (ok1) => {
          if (ok1) { onTtsDone(); return; }
          speakViaGemini(translated, 'en', (ok2) => {
            if (ok2) { onTtsDone(); return; }
            browserFallback();
          });
        });
      } else {
        // Foreign language: Gemini (Aoede/Kore) → browser
        speakViaGemini(translated, ttsLang, (ok1) => {
          if (ok1) { onTtsDone(); return; }
          browserFallback();
        });
      }

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
    contextRef.current = [];
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

  // Vietnamese status labels so the UI speaks the user's language
  const STATE_LABELS_VI = {
    idle:       activePair ? 'NHẤN ĐỂ NÓI' : 'CHỌN NGÔN NGỮ',
    listening:  'ĐANG NGHE...',
    processing: 'ĐANG DỊCH...',
    speaking:   'ĐANG NÓI...',
    error:      (errorMsg || 'Thử lại').toUpperCase(),
  };
  const STATE_LABELS_EN = {
    idle:       activePair ? 'TAP TO SPEAK' : 'SELECT LANGUAGE',
    listening:  'LISTENING...',
    processing: 'TRANSLATING...',
    speaking:   'SPEAKING...',
    error:      (errorMsg || 'TAP TO RETRY').toUpperCase(),
  };
  // Show VI labels when the active pair is Vietnamese, EN for all others
  const STATE_LABELS = activePair?.code === 'vi' ? STATE_LABELS_VI : STATE_LABELS_EN;

  // Agent display name — italic gold serif like the Salon agent
  const agentName = activePair ? activePair.name : 'Sunny';

  const overlay = (
    <div className="interp-overlay" data-state={state}>

      {/* Top bar */}
      <div className="interp-topbar">
        <span className="interp-mode-label">VOICE ASSISTANT</span>
        <button className="interp-close" onClick={handleClose} aria-label="Close interpreter">✕</button>
      </div>

      {/* Agent name — italic gold serif */}
      <div className="interp-agent-name">
        {activePair && <span className="interp-flag">{activePair.flag}</span>}
        <span>{agentName}</span>
      </div>

      {/* Center hero — translation is the star, vertically centered */}
      <div className="interp-center">
        {translation && <div className="interp-translation">{translation}</div>}
        {transcript  && <div className="interp-transcript">"{transcript}"</div>}
      </div>

      {/* Bottom controls — status + mic */}
      <div className="interp-controls">
        <div className="interp-status-label" aria-live="polite">{STATE_LABELS[state]}</div>
        <button
          className="interp-mic-area"
          onClick={handleMicTap}
          aria-label={state === 'listening' ? 'Stop listening' : 'Start listening'}
        >
          <div className="interp-wave" aria-hidden="true">
            <span /><span /><span /><span /><span />
          </div>
        </button>
      </div>

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
  );

  return ReactDOM.createPortal(overlay, document.body);
}
