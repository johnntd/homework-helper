// src/utils/interpreterBrain.js
//
// Interpreter brain — rebuilt from scratch for Vietnamese ↔ English.
//
// Architecture: TURN-LOCAL, STATELESS WITH RESPECT TO LANGUAGE DIRECTION.
//   Every turn detects its source language from the CURRENT TRANSCRIPT ONLY.
//   No expected-next-language state. No alternating-turn assumption.
//   No previous turn influences the current turn's routing.
//
// Turn pipeline (per utterance):
//   transcript → detectViEn → buildViEnPrompt → AI translate → speak → restart listening
//
// Session-level state (allowed to persist):
//   pair identity, voice preferences, session/turn IDs for debugging
//
// Turn-level state (created fresh every turn, NEVER persisted across turns):
//   sourceLang, confidence, reason, ttsLang, translated text, TTS completion guard

// ─── Voice config ─────────────────────────────────────────────────────────────

/**
 * Gemini TTS prebuilt voices for Vietnamese output.
 * All voices can speak Vietnamese — the choice is stylistic.
 */
export const VI_GEMINI_VOICES = [
  { name: 'Aoede',  label: 'Aoede',  gender: 'F', description: 'Breezy, upbeat'    },
  { name: 'Kore',   label: 'Kore',   gender: 'F', description: 'Bright, clear'     },
  { name: 'Puck',   label: 'Puck',   gender: 'M', description: 'Upbeat, bright'    },
  { name: 'Charon', label: 'Charon', gender: 'M', description: 'Informative, firm' },
  { name: 'Fenrir', label: 'Fenrir', gender: 'M', description: 'Excitable, vocal'  },
];

// ─── Core: per-turn language detection ────────────────────────────────────────

/**
 * Classify a transcript as Vietnamese ('vi') or English ('en').
 *
 * TURN-LOCAL: takes only the current transcript as input.
 * NO state from previous turns is used or referenced.
 *
 * Uses a SCORING approach:
 *
 *   +3 per toned Vietnamese char (à, ắ, ệ, ố, etc.)
 *      Vietnamese is a tonal language. Fully-toned chars (vowel + tone diacritic)
 *      are nearly impossible in phonetic English captures from vi-VN STT.
 *      Phonetic English produces BASE vowels (ê, ô) without tone marks — not these.
 *
 *   +2 per structural Vietnamese char (đ, ă, ơ, ư)
 *      Strong Vietnamese markers. Occasionally appear in phonetic English (ă in
 *      "thăng" ≈ "thank") but primarily Vietnamese structural elements.
 *
 *   +0.5 per base Vietnamese vowel without tone (ê, ô)
 *      CAN appear in phonetic English ("hê lô" = "hello"). Low weight only.
 *
 *   +5 per known Vietnamese word match (bạn, không, có, xin, chào…)
 *   -5 per known English word match (the, and, hello, thank, yes…)
 *
 *   score >= 2  → Vietnamese
 *   score <  2  → English (default when no strong signal)
 *
 * @param {string} transcript
 * @returns {{ lang: 'vi'|'en', confidence: 'high'|'medium'|'low', reason: string }}
 */
export function detectViEn(transcript) {
  const text = (transcript || '').trim();
  if (!text) {
    return { lang: 'en', confidence: 'low', reason: 'empty transcript' };
  }

  // ── Character scoring ──────────────────────────────────────────────────────
  // Toned Vietnamese chars: each is a base vowel + one of 6 tone diacritics.
  // à/á/ã/ạ/ả (a-tones), ầ/ấ/ẫ/ậ/ẩ (â-tones), ằ/ắ/ẵ/ặ/ẳ (ă-tones),
  // è/é/ẽ/ẹ/ẻ (e-tones), ề/ế/ễ/ệ/ể (ê-tones),
  // ì/í/ĩ/ị/ỉ (i-tones),
  // ò/ó/õ/ọ/ỏ (o-tones), ồ/ố/ỗ/ộ/ổ (ô-tones), ờ/ớ/ỡ/ợ/ở (ơ-tones),
  // ù/ú/ũ/ụ/ủ (u-tones), ừ/ứ/ữ/ự/ử (ư-tones),
  // ỳ/ý/ỹ/ỵ/ỷ (y-tones)
  const TONED = /[àáãạảầấẫậẩằắẵặẳèéẽẹẻềếễệểìíĩịỉòóõọỏồốỗộổờớỡợởùúũụủừứữựửỳýỹỵỷÀÁÃẠẢẦẤẪẬẨẰẮẴẶẲÈÉẼẸẺỀẾỄỆỂÌÍĨỊỈÒÓÕỌỎỒỐỖỘỔỜỚỠỢỞÙÚŨỤỦỪỨỮỰỬỲÝỸỴỶ]/g;

  // Structural Vietnamese chars: consonant đ (d-stroke), vowel bases ă, ơ, ư.
  const STRUCTURAL = /[đĐăĂơƠưƯ]/g;

  // Base Vietnamese vowels without tone mark. These CAN appear in phonetic English.
  const BASE_VI = /[êÊôÔ]/g;

  const tonedCount  = (text.match(TONED)      || []).length;
  const structCount = (text.match(STRUCTURAL)  || []).length;
  const baseCount   = (text.match(BASE_VI)     || []).length;

  // Numeric / time-pattern input — digits, colon, dot, comma, slash, space,
  // and optionally a trailing am/pm suffix that vi-VN STT adds to time expressions.
  // Examples: "7:20", "7:50 pm", "7:50 AM", "100,000", "3/4"
  // In vi-VN STT these are Vietnamese speech transcribed as numerals (e.g.
  // "bảy giờ năm mươi tối" → "7:50 pm"). They carry zero language signal;
  // the word-scoring loop would default them to English (wrong direction).
  // Treat as Vietnamese since we are always in a vi-VN STT session.
  const TIME_OR_NUMBER = /^[\d\s:.,/\-]+(?:\s*(?:am|pm))?\.?$/i;
  if (TIME_OR_NUMBER.test(text)) {
    return {
      lang: 'vi', confidence: 'low',
      reason: 'numeric/time pattern — no language markers, defaulting to Vietnamese (vi-VN STT)',
      score: 0, tonedCount: 0, structCount: 0, baseCount: 0, viWordCount: 0, enWordCount: 0,
    };
  }

  let score = tonedCount * 3 + structCount * 2 + baseCount * 0.5;

  // ── Word scoring ───────────────────────────────────────────────────────────
  // Common Vietnamese words — each match is a very strong Vi signal.
  const VI_WORDS = /\b(xin|chào|bạn|cảm|ơn|vâng|không|có|được|tôi|em|anh|chị|của|và|là|cho|một|hai|ba|người|nhà|ăn|uống|ngon|giá|tiền|đây|đó|này|nào|với|khi|từ|như|thì|mà|để|làm|nói|biết|muốn|cần|đi|đến|về|ra|vào|lên|xuống|rất|quá|lắm|thôi|vậy|dzậy|hông|hổng|sao|mình|tao|mày|tui|hả|ừ|ờ|nhé|nha|ạ|nhỉ|chứ|à|nghen)\b/gi;

  // Common English words — each match is a strong English signal.
  const EN_WORDS = /\b(the|and|is|are|was|were|have|has|will|would|could|should|this|that|with|from|what|how|why|when|where|who|hello|goodbye|thank|please|sorry|yes|no|okay|sure|can|you|your|my|we|they|he|she|it|of|to|in|for|on|at|by|do|did|be|been|get|got|go|come|see|say|think|know|want|need|like|love|make|take|give|help|use|find|just|very|so|but|if|or|not|all|some|also|well|now|then|here|there|good|great|nice|hi|hey|bye|oh|um|uh|okay|right|okay|want|need|help|today|tomorrow|price|money|name|color|style|how much|what time)\b/gi;

  const viWordCount = (text.match(VI_WORDS) || []).length;
  const enWordCount = (text.match(EN_WORDS) || []).length;

  score += viWordCount * 5;
  score -= enWordCount * 5;

  // ── Classify ───────────────────────────────────────────────────────────────
  let lang, confidence, reason;

  if (score >= 5) {
    lang = 'vi'; confidence = 'high';
    reason = `score=${score.toFixed(1)}: toned=${tonedCount} struct=${structCount} viWords=${viWordCount}`;
  } else if (score >= 2) {
    lang = 'vi'; confidence = 'medium';
    reason = `score=${score.toFixed(1)}: base=${baseCount} viWords=${viWordCount} enWords=${enWordCount}`;
  } else if (score <= -3) {
    lang = 'en'; confidence = 'high';
    reason = `score=${score.toFixed(1)}: enWords=${enWordCount}`;
  } else {
    // Ambiguous range (-3, 2) — no strong signal. Default to English.
    // English is the safer default because:
    //   - Actual Vietnamese ALWAYS has toned chars (score >= 2)
    //   - Phonetic English with only base vowels (ê, ô) lands here
    lang = 'en'; confidence = score < 0 ? 'medium' : 'low';
    reason = `score=${score.toFixed(1)}: ambiguous — defaulting to English`;
  }

  return { lang, confidence, reason, score: +score.toFixed(1), tonedCount, structCount, baseCount, viWordCount, enWordCount };
}

// ─── Core: directed translation prompt ───────────────────────────────────────

/**
 * Build a directed translation prompt for Vietnamese ↔ English.
 *
 * The source language is KNOWN before this call (from detectViEn).
 * The AI's ONLY job is to translate — NOT to detect language.
 * This eliminates the primary failure point in the old design.
 *
 * @param {'vi'|'en'} sourceLang  — detected source language for this turn
 * @param {string} [dialect]      — 'northern'|'central'|'southern' (applied to VI output only)
 * @returns {string}
 */
export function buildViEnPrompt(sourceLang, dialect) {
  const isViToEn   = sourceLang === 'vi';
  const sourceName = isViToEn ? 'Vietnamese' : 'English';
  const targetName = isViToEn ? 'English'    : 'Vietnamese';

  let dialectNote = '';
  if (!isViToEn) {
    // English → Vietnamese: apply dialect preference to output
    const d = dialect || 'southern';
    const dialectDesc =
      d === 'northern' ? 'Northern Vietnamese (Hà Nội) — use tôi/mình, không, Hanoi register.' :
      d === 'central'  ? 'Central Vietnamese (Huế/Đà Nẵng) — use Central expressions and intonation markers.' :
      'Southern Vietnamese (Sài Gòn/HCM) — use bạn/tui/mày/tao as context demands, hông/hổng for negation, dzậy/vậy coloring.';
    dialectNote = `\n\nTarget dialect: ${dialectDesc}
- Use sentence-final particles naturally (à, ạ, nhỉ, nhé, nha, chứ, đấy, vậy).
- Kinship pronouns must match the social relationship and age dynamic exactly.
- Spoken Vietnamese contracts and elides — write how people SPEAK, not textbook prose.
- Preserve any Viet-English code-switching from the source.`;
  }

  const phoneticNote = isViToEn
    ? '\nNOTE: The text was captured by a Vietnamese speech recognizer. If it contains phonetic English approximations (e.g. "hê lô" ≈ "hello", "thăng kiều" ≈ "thank you"), translate the intended English meaning.'
    : '\nNOTE: The text was captured by a speech recognizer and may contain minor errors. Interpret charitably.';

  return `You are a professional simultaneous interpreter: ${sourceName} → ${targetName}.${dialectNote}

Translate the following ${sourceName} text to ${targetName}.${phoneticNote}

STRICT OUTPUT RULES:
- Output ONLY the ${targetName} translation — no preamble, explanations, or commentary
- Short input = short output — match length and register exactly
- Preserve filler words and natural spoken speech patterns
- Do NOT explain, clarify, or add anything beyond the translation itself`;
}

// ─── Core: direction resolution ───────────────────────────────────────────────

/**
 * Given detected source language, return the TTS output language.
 *
 * Trivially stateless: always returns the opposite of sourceLang.
 * Takes ZERO previous-turn information. Has no state. Pure function.
 *
 * @param {'vi'|'en'} sourceLang
 * @returns {'en'|'vi'}
 */
export function resolveViEn(sourceLang) {
  return sourceLang === 'vi' ? 'en' : 'vi';
}

// ─── TTS pipeline (unchanged from original) ───────────────────────────────────

/**
 * Build a voice-pinned Gemini provider for interpreter mode.
 * voicePrefs maps langCode → Gemini voice name.
 *
 * @param {Function} rawGemini   - (text, langCode, cb, voiceName?) => void
 * @param {Object}   voicePrefs  - Record<langCode, string>
 * @returns {Function}           - (text, langCode, cb) => void
 */
export function buildGeminiProvider(rawGemini, voicePrefs = {}) {
  return (text, langCode, cb) => {
    const voiceName = voicePrefs[langCode] || null;
    rawGemini(text, langCode, cb, voiceName);
  };
}

/**
 * Execute the TTS cascade for an interpreter turn.
 *
 * English:     Gemini → OpenAI nova → browser SpeechSynthesis
 * Vietnamese:  Gemini (user-selected voice) → browser SpeechSynthesis
 *
 * Guarantees:
 * - onDone called exactly once regardless of which path succeeds
 * - Empty text short-circuits immediately (no hanging calls)
 *
 * @param {string} text
 * @param {'en'|'vi'} ttsLang
 * @param {{ gemini, openai, browser }} providers
 * @param {Function} onDone
 */
export function runInterpreterTts(text, ttsLang, { gemini, openai, browser }, onDone) {
  if (!text || !text.trim()) { onDone(); return; }

  let settled = false;
  const settle = () => { if (settled) return; settled = true; onDone(); };

  gemini(text, ttsLang, (geminiOk) => {
    if (geminiOk) { settle(); return; }

    if (ttsLang === 'en') {
      openai(text, (openaiOk) => {
        if (openaiOk) { settle(); return; }
        if (browser) { browser(text, settle, ttsLang); } else { settle(); }
      });
    } else {
      // Non-English: OpenAI uses an English voice — skip it
      if (browser) { browser(text, settle, ttsLang); } else { settle(); }
    }
  });
}

// ─── Legacy exports (kept for multi-pair backward compat) ─────────────────────
// These functions supported the old detection-based design.
// They are NO LONGER USED by InterpreterOverlay for the vi-en pair.
// Kept only so existing non-vi pair code continues to function.

export function buildInterpreterPrompt(pair, dialect) {
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
    langNote = '\n\nKorean: Use 존댓말/반말 matching the speaker\'s register.';
  } else if (pair.code === 'ja') {
    langNote = '\n\nJapanese: Match keigo/casual register.';
  }
  return `You are a professional simultaneous interpreter, ${pair.name} ↔ English.${langNote}

For each input:
1. Detect which language it is: ${pair.name} or English
2. Translate to the OTHER language

Output format — STRICTLY follow this:
Line 1: LANG:${pair.code}  or  LANG:en
Line 2+: translation only — nothing else`;
}

export function detectLangFromText(text, pair) {
  const patterns = {
    vi: /[àáạảãăắặẳẵâấậẩẫèéẹẻẽêếệểễìíịỉĩòóọỏõôốộổỗơớợởỡùúụủũưứựửữỳýỵỷỹđĐ]/,
    ko: /[\uAC00-\uD7AF\u1100-\u11FF]/,
    ja: /[\u3040-\u309F\u30A0-\u30FF]/,
    es: /[ñÑ¿¡]/,
  };
  const pattern = patterns[pair.code];
  return (pattern && pattern.test(text)) ? pair.code : 'en';
}

export function parseInterpreterResponse(responseText, pair, transcript) {
  const lines = responseText.trim().split('\n').map(l => l.trim()).filter(l => l);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toUpperCase().startsWith('LANG:')) {
      const code = lines[i].slice(5).trim().toLowerCase();
      if (code === pair.code || code === 'en') {
        const translationLines = lines.slice(i + 1);
        return {
          detected: code,
          translation: translationLines.length > 0 ? translationLines.join('\n').trim() : responseText.trim(),
          confidence: 'high',
        };
      }
    }
  }
  const detectedFallback = detectLangFromText(transcript, pair);
  return { detected: detectedFallback, translation: responseText.trim(), confidence: 'low' };
}

export function resolveDirection(detected, pair) {
  if (detected === 'en') return { ttsLang: pair.code, nextLocale: pair.sttLocale };
  return { ttsLang: 'en', nextLocale: pair.sttLocale };
}
