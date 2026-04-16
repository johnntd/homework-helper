// src/components/InterpreterOverlay.jsx
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './InterpreterOverlay.css';

const PAIRS = [
  { code: 'vi', label: 'VI', name: 'Vietnamese', flag: '🇻🇳', sttLocale: 'vi-VN' },
  { code: 'es', label: 'ES', name: 'Spanish',    flag: '🇪🇸', sttLocale: 'es-ES' },
  { code: 'ja', label: 'JA', name: 'Japanese',   flag: '🇯🇵', sttLocale: 'ja-JP' },
  { code: 'ko', label: 'KO', name: 'Korean',     flag: '🇰🇷', sttLocale: 'ko-KR' },
];

// Derive TTS lang and next STT locale from the current round's STT locale.
// This is more reliable than detecting from AI output text, which can code-switch
// (mix languages), causing detectOutputLang to misclassify direction.
//
// Logic:
//   Current round used pair.sttLocale (VI/KO/JA/ES speaker) →
//     AI outputs English → TTS in EN → next round: en-US (English speaker responds)
//   Current round used en-US (English speaker) →
//     AI outputs foreign → TTS in pair.code → next round: pair.sttLocale (foreign speaker responds)
function deriveTtsAndNextLocale(sttLocale, pair) {
  if (sttLocale === 'en-US') {
    return { ttsLang: pair.code, nxtLocale: pair.sttLocale };
  }
  return { ttsLang: 'en', nxtLocale: 'en-US' };
}

export default function InterpreterOverlay({ open, onClose, speakViaOpenAI, speakViaGemini, dialect }) {
  const [state,       setState]       = useState('idle');
  const [activePair,  setActivePair]  = useState(null);
  const [transcript,  setTranscript]  = useState('');
  const [translation, setTranslation] = useState('');
  const [errorMsg,    setErrorMsg]    = useState('');

  const recRef         = useRef(null);
  const abortRef       = useRef(null);
  const errorTimerRef  = useRef(null);
  const isMounted      = useRef(true);
  const nextLocaleRef  = useRef(null); // STT locale for the next listen cycle
  const contextRef     = useRef([]);   // rolling conversation context

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
      contextRef.current  = [];
      nextLocaleRef.current = null;
    }
  }, [open]);

  function _stopAll() {
    if (recRef.current) {
      const rec = recRef.current;
      recRef.current = null;
      try { rec.abort(); } catch (_) {}
    }
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
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

  // sttLocale: which locale to use for this listen cycle (en-US or pair.sttLocale).
  // Using the right locale for each party gives clean transcription — mixing locales
  // (e.g. vi-VN STT on English speech) produces phonetic garble that confuses the AI.
  // We derive the locale from the previous translation output, not a turn counter.
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

  async function _translate(text, pair, sttLocale) {
    let langNote = '';
    if (pair.code === 'vi') {
      const d = dialect || 'southern';
      const dialectDesc =
        d === 'northern' ? 'Northern Vietnamese (Hà Nội) — use tôi/mình, không, Hanoi register.' :
        d === 'central'  ? 'Central Vietnamese (Huế/Đà Nẵng) — use Central expressions and intonation markers.' :
        'Southern Vietnamese (Sài Gòn/HCM) — use bạn/tui/mày/tao as context demands, hông/hổng for negation, dzậy/vậy coloring.';
      langNote = `\n\nVietnamese dialect: ${dialectDesc}
- Use sentence-final particles naturally (à, ạ, nhỉ, nhé, nha, chứ, đấy, vậy).
- Kinship pronouns must match the social relationship and age dynamic exactly.
- Spoken Vietnamese contracts and elides — write how people SPEAK, not textbook prose.
- Preserve Viet-English code-switching if the speaker mixes languages.`;
    } else if (pair.code === 'ko') {
      langNote = `\n\nKorean: Use 존댓말/반말 matching the speaker's register. Preserve sentence-final endings and natural spoken particles.`;
    } else if (pair.code === 'ja') {
      langNote = `\n\nJapanese: Match keigo/casual register. Use natural spoken contractions and sentence-final particles (ね, よ, か).`;
    }

    // Bidirectional prompt — the AI auto-detects which language was spoken and
    // translates to the other one. This keeps rolling context coherent regardless
    // of how many alternating exchanges have accumulated.
    const systemPrompt =
      `You are a professional simultaneous interpreter, ${pair.name} ↔ English.${langNote}

Translate to the OTHER language:
- ${pair.name} input → English output
- English input → ${pair.name} output

STRICT OUTPUT RULES — violations break the product:
- Output ONLY the translated phrase. Nothing else.
- NEVER add "Hmm", "Actually", "Let me", reasoning, clarifications, or any meta-commentary.
- NEVER explain that you are translating or what the input means.
- If input is unclear or garbled, output your best-guess translation — no commentary.
- Short input = short output. Match length and register exactly.
- Preserve filler words (uh, um, yeah, ừ, thì) — don't sanitize natural speech.`;

    const messages = [
      ...contextRef.current.slice(-6),
      { role: 'user', content: text },
    ];

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, system: systemPrompt, maxTokens: 200 }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const translated = (data.content?.[0]?.text || '').trim();
      if (!translated) throw new Error('Empty response');

      if (!isMounted.current) return;
      abortRef.current = null;

      contextRef.current = [
        ...contextRef.current,
        { role: 'user',      content: text },
        { role: 'assistant', content: translated },
      ].slice(-6);

      setTranslation(translated);
      setState('speaking');

      // Derive TTS lang and next STT locale from the current round's STT locale —
      // more reliable than detecting language from AI output, which can code-switch.
      const { ttsLang, nxtLocale } = deriveTtsAndNextLocale(sttLocale, pair);
      nextLocaleRef.current = nxtLocale;

      const onTtsDone = () => {
        if (!isMounted.current || !open) return;
        setTimeout(() => {
          if (!isMounted.current || !open) return;
          _startListening(pair, nxtLocale);
        }, 500);
      };

      speakViaGemini(translated, ttsLang, (ok) => {
        if (ok) { onTtsDone(); return; }
        speakViaOpenAI(translated, onTtsDone);
      });

    } catch (e) {
      if (e.name === 'AbortError') return;
      if (!isMounted.current) return;
      _setError((e.message?.length < 60 ? e.message : 'Translation failed') + ' — tap to retry');
    }
  }

  function handleSelectPair(pair) {
    if (state === 'processing') return;
    _stopAll();
    setActivePair(pair);
    setTranscript('');
    setTranslation('');
    setErrorMsg('');
    contextRef.current   = [];
    nextLocaleRef.current = pair.sttLocale; // start listening for the foreign speaker
    _startListening(pair, pair.sttLocale);
  }

  function handleMicTap() {
    if (!activePair) return;
    const loc = nextLocaleRef.current ?? activePair.sttLocale;
    if (state === 'speaking') {
      _stopAll();
      _startListening(activePair, loc);
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
