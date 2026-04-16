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

// Detect which language the AI output is written in, for TTS voice selection.
// We run this on the TRANSLATION (accurate AI-produced text), not the STT input.
// VI/KO/JA: Unicode character ranges are unambiguous.
// ES: ñ, accented vowels, ¿, ¡ are reliable Spanish markers vs English.
function detectOutputLang(text, pair) {
  switch (pair.code) {
    case 'vi':
      return /[àảãáạăặằắẵẳậâầấẫẩặđèẻẽéẹêềếễểệìỉĩíịòỏõóọôồốỗổộơờớỡởợùủũúụưừứữửựỳỷỹýỵ]/i.test(text)
        ? 'vi' : 'en';
    case 'ko':
      return /[\uAC00-\uD7AF\u1100-\u11FF]/.test(text) ? 'ko' : 'en';
    case 'ja':
      return /[\u3040-\u30FF\u4E00-\u9FFF]/.test(text) ? 'ja' : 'en';
    case 'es':
      return /[ñáéíóúü¿¡]/i.test(text) ? 'es' : 'en';
    default:
      return 'en';
  }
}

// dialect: 'northern' | 'southern' | 'central' — only meaningful when pair.code === 'vi'
export default function InterpreterOverlay({ open, onClose, speakViaOpenAI, speakViaGemini, dialect }) {
  const [state,       setState]       = useState('idle');
  const [activePair,  setActivePair]  = useState(null);
  const [transcript,  setTranscript]  = useState('');
  const [translation, setTranslation] = useState('');
  const [errorMsg,    setErrorMsg]    = useState('');

  const recRef        = useRef(null);   // active SpeechRecognition instance
  const abortRef      = useRef(null);   // AbortController for in-flight /api/chat
  const errorTimerRef = useRef(null);   // auto-reset from error state
  const isMounted     = useRef(true);
  // Rolling context — last 6 utterances (3 exchanges) for pronoun/register coherence.
  // The bidirectional system prompt stays consistent regardless of which direction
  // each exchange went, so context never contradicts the translation direction.
  const contextRef    = useRef([]);

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
      contextRef.current = [];
    }
  }, [open]);

  // ── Internal helpers ────────────────────────────────────────────────────────

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

  function _startListening(pair) {
    if (!isMounted.current || !open) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { _setError('Speech recognition unavailable'); return; }

    if (recRef.current) {
      const oldRec = recRef.current;
      recRef.current = null;
      try { oldRec.abort(); } catch (_) {}
    }

    const rec = new SR();
    // Always use the foreign locale — the STT cloud is multilingual enough to
    // capture the other party reasonably well, and the AI handles direction.
    rec.lang            = pair.sttLocale;
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

      // Pick highest-confidence alternative
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
      _translate(text, pair);
    };

    rec.onerror = (e) => {
      recRef.current = null;
      if (e.error === 'no-speech') {
        if (isMounted.current && open) _startListening(pair);
      } else if (e.error === 'aborted') {
        // intentional — do nothing
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
          setTimeout(() => { if (isMounted.current && open) _startListening(pair); }, 500);
        }
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      setState('listening');
    } catch (_) {
      recRef.current = null;
      _setError('Could not start microphone');
    }
  }

  async function _translate(text, pair) {
    // Language-specific guidance appended to the shared prompt
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
      langNote = `\n\nKorean-specific: Use the appropriate speech level (존댓말/반말) that matches the speaker's register. Preserve sentence-final endings and natural spoken Korean particles.`;
    } else if (pair.code === 'ja') {
      langNote = '\n\nJapanese-specific: Match the speech level (keigo/casual) to the register. Use natural spoken Japanese — contractions, sentence-final particles (ね, よ, か), natural rhythm.';
    }

    // BIDIRECTIONAL prompt — the AI detects which language was spoken and translates
    // to the other one automatically. This is the key design decision:
    // - No turn tracking needed (no "who speaks next" logic to get wrong)
    // - Rolling context stays coherent across many alternating exchanges
    // - Works whether the same person speaks twice or parties alternate
    const systemPrompt =
      `You are a professional simultaneous interpreter with native-level fluency in ${pair.name} and English.${langNote}

You will receive speech from either a ${pair.name} speaker or an English speaker.
Translate to the OTHER language automatically — do NOT keep the same language:
- ${pair.name} input → output English
- English input → output ${pair.name}

Rules:
- Output ONLY the interpreted utterance. No labels, no parentheses, no meta-commentary.
- Natural spoken language — never stiff or written-style phrasing.
- Match register (casual/formal/intimate) and emotional tone exactly.
- For short utterances (greetings, yes/no, single concepts) keep the output equally short.
- Preserve filler words and conversational rhythm — don't sanitize natural speech.
- If the speaker code-switches, interpret the dominant intent in the target language.`;

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
        body: JSON.stringify({ messages, system: systemPrompt, maxTokens: 300 }),
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const translated = data.content?.[0]?.text?.trim() || '';
      if (!translated) throw new Error('Empty response from server');

      if (!isMounted.current) return;
      abortRef.current = null;

      contextRef.current = [
        ...contextRef.current,
        { role: 'user',      content: text },
        { role: 'assistant', content: translated },
      ].slice(-6);

      setTranslation(translated);
      setState('speaking');

      // Detect TTS language from the OUTPUT text (AI-produced, accurate) rather than
      // trying to classify the STT input (which may be garbled or ambiguous).
      const ttsLang = detectOutputLang(translated, pair);

      const onTtsDone = () => {
        if (!isMounted.current || !open) return;
        setTimeout(() => {
          if (!isMounted.current || !open) return;
          _startListening(pair);
        }, 500);
      };

      // Gemini first (Aoede for VI, Sulafat for EN, Kore for KO/JA).
      // OpenAI nova as fallback — EN-optimised but better than silence.
      speakViaGemini(translated, ttsLang, (ok) => {
        if (ok) { onTtsDone(); return; }
        speakViaOpenAI(translated, onTtsDone);
      });

    } catch (e) {
      if (e.name === 'AbortError') return;
      if (!isMounted.current) return;
      const msg = e.message && e.message.length < 50 ? e.message : 'Translation failed';
      _setError(msg + ' — tap to retry');
    }
  }

  // ── User interactions ───────────────────────────────────────────────────────

  function handleSelectPair(pair) {
    if (state === 'processing') return;
    _stopAll();
    setActivePair(pair);
    setTranscript('');
    setTranslation('');
    setErrorMsg('');
    contextRef.current = [];
    _startListening(pair);
  }

  function handleMicTap() {
    if (!activePair) return;
    if (state === 'speaking') {
      // Interrupt TTS and start listening right away
      _stopAll();
      _startListening(activePair);
    } else if (state === 'listening') {
      _stopAll();
      setState('idle');
    } else if (state === 'idle' || state === 'error') {
      setErrorMsg('');
      _startListening(activePair);
    }
  }

  function handleClose() {
    _stopAll();
    onClose();
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!open) return null;

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
  const STATE_LABELS = activePair?.code === 'vi' ? STATE_LABELS_VI : STATE_LABELS_EN;

  const overlay = (
    <div className="interp-overlay" data-state={state}>

      <div className="interp-topbar">
        <span className="interp-mode-label">VOICE ASSISTANT</span>
        <button className="interp-close" onClick={handleClose} aria-label="Close interpreter">✕</button>
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
          aria-label={state === 'listening' ? 'Stop listening' : 'Start listening'}
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
