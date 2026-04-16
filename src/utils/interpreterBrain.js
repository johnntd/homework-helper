// src/utils/interpreterBrain.js
//
// Pure brain logic for interpreter mode.
// Per-turn auto-detect bidirectional routing — no UI dependencies, fully testable.
//
// Flow per turn:
//   transcript arrives → AI detects which language (constrained to the pair) →
//   resolveDirection picks ttsLang + nextSTTLocale → speak → listen next turn

/**
 * Gemini TTS prebuilt voices that work well for Vietnamese output.
 * Users can select any of these; the selection is persisted and applied on every
 * Vietnamese TTS turn. All voices can speak Vietnamese — the choice is stylistic.
 */
export const VI_GEMINI_VOICES = [
  { name: 'Aoede',  label: 'Aoede',  gender: 'F', description: 'Breezy, upbeat'   },
  { name: 'Kore',   label: 'Kore',   gender: 'F', description: 'Bright, clear'    },
  { name: 'Puck',   label: 'Puck',   gender: 'M', description: 'Upbeat, bright'   },
  { name: 'Charon', label: 'Charon', gender: 'M', description: 'Informative, firm'},
  { name: 'Fenrir', label: 'Fenrir', gender: 'M', description: 'Excitable, vocal' },
];

/**
 * Build a voice-pinned Gemini provider for interpreter mode.
 *
 * voicePrefs maps langCode → Gemini voice name.
 * Example: { vi: 'Kore' }
 *
 * The returned provider conforms to the (text, langCode, cb) interface expected
 * by runInterpreterTts, and passes the pinned voice name as a 4th argument to
 * rawGemini so the caller can forward it to the /api/tts endpoint.
 *
 * Design constraints:
 * - resolveDirection and runInterpreterTts remain voice-agnostic (single responsibility)
 * - Voice injection happens only here, at the provider boundary
 * - A null voice means "use server default from VOICE_MAP" (no override)
 * - The same voice is used on every turn — no re-resolution, no auto-pick
 *
 * @param {Function} rawGemini  - (text: string, langCode: string, cb: (ok: bool)=>void, voiceName?: string) => void
 * @param {Object}   voicePrefs - Record<langCode, string>  e.g. { vi: 'Kore' }
 * @returns {Function}          - (text: string, langCode: string, cb: (ok: bool)=>void) => void
 */
export function buildGeminiProvider(rawGemini, voicePrefs = {}) {
  return (text, langCode, cb) => {
    // Look up the pinned voice for this langCode. null = let server pick from VOICE_MAP.
    const voiceName = voicePrefs[langCode] || null;
    rawGemini(text, langCode, cb, voiceName);
  };
}

/**
 * Build the interpreter system prompt.
 * The AI must output "LANG:{code}" on line 1, translation on line 2+.
 *
 * @param {{ code: string, name: string }} pair
 * @param {string} [dialect] - 'northern'|'central'|'southern' (vi only)
 * @returns {string}
 */
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
    langNote = '\n\nKorean: Use 존댓말/반말 matching the speaker\'s register. Preserve sentence-final endings and natural spoken particles.';
  } else if (pair.code === 'ja') {
    langNote = '\n\nJapanese: Match keigo/casual register. Use natural spoken contractions and sentence-final particles (ね, よ, か).';
  }

  return `You are a professional simultaneous interpreter, ${pair.name} ↔ English.${langNote}

For each input:
1. Detect which language it is: ${pair.name} or English
2. Translate to the OTHER language

Output format — STRICTLY follow this, no deviations:
Line 1: LANG:${pair.code}  or  LANG:en
Line 2+: translation only — nothing else

Detection rules:
- ${pair.name} script, characters, diacritics, or particles present → LANG:${pair.code}
- Clearly English words → LANG:en
- For ${pair.name === 'Vietnamese' ? 'Vietnamese' : pair.name}: phonetic English captured by ${pair.name} STT (e.g. "hê lô" = "hello") → still detect as LANG:en
- Ambiguous input → make your best judgment; lean toward the language with more matching features

STRICT OUTPUT RULES:
- Output EXACTLY: first line is LANG:${pair.code} or LANG:en, remaining lines are the translation
- NEVER add "Hmm", "Actually", "Let me", reasoning, clarifications, or extra lines
- NEVER explain that you are translating or what the input means
- Short input = short output. Match length and register exactly.
- Preserve filler words (uh, um, yeah, ừ, thì) — don't sanitize natural speech.`;
}

/**
 * Detect language from transcript text using Unicode character ranges.
 * Pair-constrained: only distinguishes between 'en' and pair.code.
 *
 * Used as a stateless fallback when the AI response lacks a LANG: line.
 * Relies on the user's actual spoken transcript — no turn-to-turn state.
 *
 * @param {string} text      — the user's spoken transcript
 * @param {{ code: string }} pair
 * @returns {string}         — pair.code if foreign-language characters found, else 'en'
 */
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

/**
 * Parse the AI response to extract detected language code and translation text.
 *
 * Expected AI format:
 *   LANG:{code}
 *   {translation}
 *
 * Returns:
 *   detected    — 'en' | pair.code | null
 *   translation — translated string
 *   confidence  — 'high' (LANG: line found) | 'low' (fell back to text-based detection)
 *
 * @param {string} responseText
 * @param {{ code: string }} pair
 * @param {string} transcript   — the user's spoken transcript; used for stateless fallback detection
 * @returns {{ detected: string, translation: string, confidence: 'high'|'low' }}
 */
export function parseInterpreterResponse(responseText, pair, transcript) {
  const lines = responseText.trim().split('\n').map(l => l.trim()).filter(l => l);

  // Scan for LANG: line — tolerates preamble, case-insensitive, space after colon
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toUpperCase().startsWith('LANG:')) {
      const code = lines[i].slice(5).trim().toLowerCase();
      if (code === pair.code || code === 'en') {
        const translationLines = lines.slice(i + 1);
        return {
          detected: code,
          // If nothing follows LANG: line, fall back to the full raw text as translation
          translation: translationLines.length > 0
            ? translationLines.join('\n').trim()
            : responseText.trim(),
          confidence: 'high',
        };
      }
    }
  }

  // No valid LANG: line found — detect from the user's transcript text.
  // detectLangFromText looks for foreign-language characters in what the user said.
  // This is fully stateless: no previous-turn state, no sttLocale dependency.
  const detectedFallback = detectLangFromText(transcript, pair);
  return {
    detected: detectedFallback,
    translation: responseText.trim(),
    confidence: 'low',
  };
}

/**
 * Resolve TTS output language and next STT locale from the detected input language.
 *
 * This is the bidirectional routing core.
 * It is stateless and re-evaluated fresh every turn — no stale direction possible.
 *
 * detected === 'en'       → English was spoken  → translate to foreign  → speak pair.code
 * detected === pair.code  → Foreign was spoken  → translate to English  → speak 'en'
 *
 * STT locale strategy (confidence-based):
 *   confidence='high' + detected='en'  → nextLocale='en-US'        — AI reliably identified
 *                                         English; give the English speaker clean STT next turn.
 *   all other cases                    → nextLocale=pair.sttLocale  — cascade-collapse prevention.
 *
 * Why defaulting to pair.sttLocale is safe:
 *   English through a foreign-locale STT is transcribed phonetically.
 *   The AI prompt handles this: "phonetic English captured by [Language] STT → detect as LANG:en".
 *   The detectLangFromText fallback handles it via absence of foreign-language characters.
 *
 * Why low-confidence always returns pair.sttLocale (cascade prevention):
 *   If AI fails to produce a LANG: line → confidence='low' → detected comes from detectLangFromText.
 *   Phonetic English through a foreign-locale STT can include foreign diacritics
 *   (e.g. "hê lô" for "hello" — ê and ô are in the Vietnamese pattern), causing
 *   detectLangFromText to return 'vi'. With low-confidence, nextLocale stays pair.sttLocale
 *   regardless — no locale drift possible.
 *   If we trusted low-confidence 'en' and switched to en-US:
 *     false 'en' (phonetic English with diacritics) → pair.sttLocale ← would be ok
 *     BUT the self-reinforcing path: any true misdetection → en-US → Vietnamese garbled
 *     through en-US → no diacritics → fallback 'en' again → en-US → STUCK FOREVER.
 *
 * @param {string} detected              — 'en' | pair.code
 * @param {{ code: string, sttLocale: string }} pair
 * @param {'high'|'low'} [confidence='low']  — from parseInterpreterResponse
 * @returns {{ ttsLang: string, nextLocale: string }}
 */
export function resolveDirection(detected, pair, confidence = 'low') {
  const ttsLang = detected === 'en' ? pair.code : 'en';

  // Switch STT locale to en-US ONLY when the AI definitively identified English.
  // Low confidence (detectLangFromText fallback) → always pair.sttLocale → no cascade.
  if (confidence === 'high' && detected === 'en') {
    return { ttsLang, nextLocale: 'en-US' };
  }
  return { ttsLang, nextLocale: pair.sttLocale };
}

/**
 * Execute the TTS cascade for an interpreter turn.
 *
 * Provider chain:
 *   English:     Gemini (Sulafat) → OpenAI nova → browser SpeechSynthesis
 *   Non-English: Gemini (Aoede/Kore) → browser SpeechSynthesis (no OpenAI — English-only voice)
 *
 * Guarantees:
 * - `onDone` is called exactly once regardless of which path is taken
 * - No silent no-op paths — if all providers fail, browser is the final backstop
 * - Empty text short-circuits immediately (no hanging async calls)
 *
 * @param {string} text     - translated text to speak
 * @param {string} ttsLang  - 'en' | pair.code ('vi', 'ko', 'ja', 'es')
 * @param {object} providers
 *   @param {Function} providers.gemini   (text, langCode, (ok: bool)=>void)=>void
 *   @param {Function} providers.openai   (text, (ok: bool)=>void)=>void   — English only
 *   @param {Function} [providers.browser] (text, onComplete, langOverride)=>void — final fallback
 * @param {Function} onDone - ()=>void — called once when audio completes or all providers fail
 */
export function runInterpreterTts(text, ttsLang, { gemini, openai, browser }, onDone) {
  if (!text || !text.trim()) {
    onDone();
    return;
  }

  // Once-only guard: a provider firing its callback twice (race condition, stale ref)
  // must not call onDone twice. Deduplication is also enforced at the component level
  // via turnIdRef + ttsCallCompleted, but this ensures the cascade itself is safe.
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    onDone();
  };

  gemini(text, ttsLang, (geminiOk) => {
    if (geminiOk) { settle(); return; }

    if (ttsLang === 'en') {
      // English: try OpenAI nova as secondary provider
      openai(text, (openaiOk) => {
        if (openaiOk) { settle(); return; }
        // Both API providers failed — browser synthesis is the final backstop
        if (browser) {
          browser(text, settle, ttsLang);
        } else {
          settle(); // no browser available, advance anyway
        }
      });
    } else {
      // Non-English: OpenAI uses an English voice (nova) — skip it, go to browser
      if (browser) {
        browser(text, settle, ttsLang);
      } else {
        settle();
      }
    }
  });
}
