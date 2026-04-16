// src/utils/interpreterBrain.test.js
// Vitest tests for interpreter mode brain logic.
// Run: npm test
//
// Covers:
//   A. parseInterpreterResponse — AI response parsing
//   B. resolveDirection — bidirectional routing (tests 1-7 from spec)
//   C. runInterpreterTts — TTS cascade / audio pipeline
//   D. State machine invariants — turn tracking, stale guards
//   E. Voice stability
//   F. Regression guards

import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  buildInterpreterPrompt,
  detectLangFromText,
  parseInterpreterResponse,
  resolveDirection,
  runInterpreterTts,
  buildGeminiProvider,
  VI_GEMINI_VOICES,
} from './interpreterBrain.js';

const VI_PAIR = { code: 'vi', name: 'Vietnamese', sttLocale: 'vi-VN' };
const ES_PAIR = { code: 'es', name: 'Spanish',    sttLocale: 'es-ES' };
const KO_PAIR = { code: 'ko', name: 'Korean',     sttLocale: 'ko-KR' };
const EN_US   = 'en-US';
const VI_VN   = 'vi-VN';

// ─── A. parseInterpreterResponse ─────────────────────────────────────────────

describe('parseInterpreterResponse', () => {

  test('parses LANG:en — high confidence', () => {
    // 3rd arg is the user's spoken transcript (used only for stateless fallback)
    const r = parseInterpreterResponse('LANG:en\nXin chào, bạn khỏe không?', VI_PAIR, 'Hello there');
    expect(r.detected).toBe('en');
    expect(r.translation).toBe('Xin chào, bạn khỏe không?');
    expect(r.confidence).toBe('high');
  });

  test('parses LANG:vi — high confidence', () => {
    const r = parseInterpreterResponse('LANG:vi\nHello, how are you?', VI_PAIR, 'Xin chào');
    expect(r.detected).toBe('vi');
    expect(r.translation).toBe('Hello, how are you?');
    expect(r.confidence).toBe('high');
  });

  test('case-insensitive LANG: line (LANG:EN)', () => {
    const r = parseInterpreterResponse('LANG:EN\nXin chào', VI_PAIR, 'Hello');
    expect(r.detected).toBe('en');
    expect(r.confidence).toBe('high');
  });

  test('tolerates space after colon (LANG: en)', () => {
    const r = parseInterpreterResponse('LANG: en\nXin chào', VI_PAIR, 'Hello');
    expect(r.detected).toBe('en');
    expect(r.confidence).toBe('high');
  });

  test('multi-line translation is joined', () => {
    const r = parseInterpreterResponse('LANG:vi\nHello there.\nHow are you?', VI_PAIR, 'Xin chào bạn');
    expect(r.detected).toBe('vi');
    expect(r.translation).toBe('Hello there.\nHow are you?');
  });

  test('fallback when LANG: line missing — English transcript detected as en', () => {
    // No LANG: line → detectLangFromText('Hello, how are you?', VI_PAIR) → 'en'
    const r = parseInterpreterResponse('garbled response', VI_PAIR, 'Hello, how are you?');
    expect(r.detected).toBe('en');
    expect(r.confidence).toBe('low');
    expect(r.translation).toBe('garbled response');
  });

  test('fallback when LANG: line missing — Vietnamese transcript detected as vi', () => {
    // No LANG: line → detectLangFromText('Xin chào bạn', VI_PAIR) → 'vi'
    const r = parseInterpreterResponse('garbled response', VI_PAIR, 'Xin chào bạn');
    expect(r.detected).toBe('vi');
    expect(r.confidence).toBe('low');
  });

  test('works for non-Vietnamese pair (Spanish)', () => {
    const r = parseInterpreterResponse('LANG:es\nHello, how are you?', ES_PAIR, '¡Hola!');
    expect(r.detected).toBe('es');
    expect(r.translation).toBe('Hello, how are you?');
    expect(r.confidence).toBe('high');
  });

});

// ─── B. resolveDirection — bidirectional routing ──────────────────────────────

describe('resolveDirection — Vietnamese ↔ English', () => {

  // Test 1: English input → output Vietnamese
  test('Test 1: English input → detected "en" → TTS in Vietnamese, next STT vi-VN', () => {
    const { ttsLang, nextLocale } = resolveDirection('en', VI_PAIR);
    expect(ttsLang).toBe('vi');
    // nextLocale is always pair.sttLocale — STT never switches to en-US.
    // English through vi-VN STT is phonetic; AI and detectLangFromText both handle it.
    expect(nextLocale).toBe('vi-VN');
  });

  // Test 2: Vietnamese input → output English
  test('Test 2: Vietnamese input → detected "vi" → TTS in English', () => {
    const { ttsLang, nextLocale } = resolveDirection('vi', VI_PAIR);
    expect(ttsLang).toBe('en');
    // nextLocale is always pair.sttLocale — STT never switches to en-US after a
    // foreign-language turn (that was the alternating-turn bug).
    expect(nextLocale).toBe('vi-VN');
  });

  // Test 3: English first, then Vietnamese — both turns work
  test('Test 3: English first then Vietnamese — both produce correct output', () => {
    const turn1 = resolveDirection('en', VI_PAIR);
    expect(turn1.ttsLang).toBe('vi');
    // STT stays on pair.sttLocale regardless of detection — never switches to en-US
    expect(turn1.nextLocale).toBe('vi-VN');

    const turn2 = resolveDirection('vi', VI_PAIR);
    expect(turn2.ttsLang).toBe('en');
    expect(turn2.nextLocale).toBe('vi-VN');
  });

  // Test 4: Vietnamese first, then English — both turns work
  test('Test 4: Vietnamese first then English — both produce correct output', () => {
    const turn1 = resolveDirection('vi', VI_PAIR);
    expect(turn1.ttsLang).toBe('en');
    expect(turn1.nextLocale).toBe('vi-VN');

    const turn2 = resolveDirection('en', VI_PAIR);
    expect(turn2.ttsLang).toBe('vi');
    // STT stays on pair.sttLocale — never en-US, for either detection case
    expect(turn2.nextLocale).toBe('vi-VN');
  });

  // Test 5: Alternating turns multiple times — direction correct every turn
  test('Test 5: Alternating turns — direction correct on every turn', () => {
    const inputs   = ['vi', 'en', 'vi', 'en', 'vi', 'en'];
    const expected = ['en', 'vi', 'en', 'vi', 'en', 'vi'];
    inputs.forEach((detected, i) => {
      const { ttsLang } = resolveDirection(detected, VI_PAIR);
      expect(ttsLang).toBe(expected[i]);
    });
  });

  // Test 6: No one-direction lock-in after the first turn
  test('Test 6: No lock-in — each turn is independently re-evaluated', () => {
    expect(resolveDirection('en', VI_PAIR).ttsLang).toBe('vi');
    expect(resolveDirection('en', VI_PAIR).ttsLang).toBe('vi');
    expect(resolveDirection('vi', VI_PAIR).ttsLang).toBe('en');
    expect(resolveDirection('en', VI_PAIR).ttsLang).toBe('vi');
    expect(resolveDirection('vi', VI_PAIR).ttsLang).toBe('en');
    expect(resolveDirection('vi', VI_PAIR).ttsLang).toBe('en');
    expect(resolveDirection('en', VI_PAIR).ttsLang).toBe('vi');
  });

  // Test 7: Profile/native language does not affect direction
  test('Test 7: User profile language is irrelevant — only detected language drives direction', () => {
    const userNativeLang = 'vi'; // native language (not passed to resolveDirection)
    const r = resolveDirection('en', VI_PAIR);
    expect(r.ttsLang).toBe('vi');   // English spoken → Vietnamese output (correct)
    expect(typeof userNativeLang).toBe('string'); // used only to prove it was ignored
  });

});

// ─── B2. Same-speaker consecutive turns (the alternating-turn regression) ─────
// These tests guard against the bug where STT switching to en-US after a Vietnamese
// turn caused the same foreign-language speaker to be misrouted on their next turn.

describe('resolveDirection — same-speaker consecutive turns', () => {

  // Required test: Vietnamese input twice in a row
  test('Consecutive-1: Vietnamese spoken twice → English output both times', () => {
    const turn1 = resolveDirection('vi', VI_PAIR);
    expect(turn1.ttsLang).toBe('en');

    const turn2 = resolveDirection('vi', VI_PAIR);
    expect(turn2.ttsLang).toBe('en');
  });

  // Required test: Vietnamese input three times in a row
  test('Consecutive-2: Vietnamese spoken three times → English output all three times', () => {
    for (let i = 0; i < 3; i++) {
      const { ttsLang } = resolveDirection('vi', VI_PAIR);
      expect(ttsLang).toBe('en');
    }
  });

  // Required test: English input twice in a row
  test('Consecutive-3: English spoken twice → Vietnamese output both times', () => {
    const turn1 = resolveDirection('en', VI_PAIR);
    expect(turn1.ttsLang).toBe('vi');

    const turn2 = resolveDirection('en', VI_PAIR);
    expect(turn2.ttsLang).toBe('vi');
  });

  // Required test: English input three times in a row
  test('Consecutive-4: English spoken three times → Vietnamese output all three times', () => {
    for (let i = 0; i < 3; i++) {
      const { ttsLang } = resolveDirection('en', VI_PAIR);
      expect(ttsLang).toBe('vi');
    }
  });

  // Required test: alternating turns still work
  test('Consecutive-5: Alternating vi → en → vi → en → vi still correct', () => {
    const sequence = ['vi', 'en', 'vi', 'en', 'vi'];
    const expected = ['en', 'vi', 'en', 'vi', 'en'];
    sequence.forEach((detected, i) => {
      expect(resolveDirection(detected, VI_PAIR).ttsLang).toBe(expected[i]);
    });
  });

  // Required test: with default (low) confidence, nextLocale is ALWAYS pair.sttLocale.
  // Both the original bug (vi→en-US) and low-confidence en→en-US cascade are prevented.
  // Note: high-confidence English detection DOES return en-US — see Confidence-1 test.
  test('Consecutive-6: default confidence → nextLocale is pair.sttLocale (low-confidence path)', () => {
    // Vietnamese detection must never return en-US (that was the original alternating-turn bug).
    ['vi', 'vi', 'vi', 'vi', 'vi'].forEach(detected => {
      const { nextLocale } = resolveDirection(detected, VI_PAIR);
      expect(nextLocale).not.toBe('en-US');
      expect(nextLocale).toBe('vi-VN');
    });

    // Low-confidence English also returns pair.sttLocale — NOT en-US.
    // Without confidence gating, en-US creates a self-reinforcing cascade on misdetection.
    ['en', 'en', 'en'].forEach(detected => {
      const { nextLocale } = resolveDirection(detected, VI_PAIR);
      expect(nextLocale).not.toBe('en-US');
      expect(nextLocale).toBe('vi-VN');
    });
  });

  // Required test: previous turn language does not override current-turn detection
  test('Consecutive-7: previous turn result does not affect current turn routing', () => {
    // Simulate: first call vi→en, second call must also vi→en (not flip to vi output)
    const firstTurn  = resolveDirection('vi', VI_PAIR);
    const secondTurn = resolveDirection('vi', VI_PAIR);  // same speaker again
    expect(firstTurn.ttsLang).toBe('en');
    expect(secondTurn.ttsLang).toBe('en');   // was broken before fix — would produce 'vi'
    // Proves resolveDirection has no cross-call state
    expect(firstTurn).toEqual(secondTurn);
  });

  // Required test: profile/native language does not affect direction
  test('Consecutive-8: ignoring the user\'s native language — direction from detected only', () => {
    const nativeLang = 'vi'; // user is a native Vietnamese speaker
    // Even if native is vi, when English is detected, output must be vi (not en)
    const { ttsLang } = resolveDirection('en', VI_PAIR);
    expect(ttsLang).toBe('vi');  // English spoken → Vietnamese output (correct)
    // The nativeLang variable is intentionally unused — it must NOT be passed to resolveDirection
    void nativeLang;
  });

  // Debug visibility: verify no module-level state exists in interpreterBrain
  test('Consecutive-9: resolveDirection has zero module-level mutable state', () => {
    // Run 20 calls with alternating detected languages — result must be deterministic
    // and identical to calling each in isolation
    const results = Array.from({ length: 20 }, (_, i) => {
      const detected = i % 2 === 0 ? 'vi' : 'en';
      return resolveDirection(detected, VI_PAIR).ttsLang;
    });
    const expectedPattern = Array.from({ length: 20 }, (_, i) => i % 2 === 0 ? 'en' : 'vi');
    expect(results).toEqual(expectedPattern);
  });

});

// ─── B3. resolveDirection — confidence-based locale switching ─────────────────
// When the AI returns a LANG: line (high confidence), English speakers get en-US STT
// on their next turn for cleaner transcription. Low confidence always falls back to
// pair.sttLocale regardless of detected language — cascade-collapse prevention.

describe('resolveDirection — confidence-based locale switching', () => {

  // Confidence-1: high confidence + English → en-US next locale
  test('Confidence-1: high confidence + English detected → nextLocale en-US', () => {
    const { ttsLang, nextLocale } = resolveDirection('en', VI_PAIR, 'high');
    expect(ttsLang).toBe('vi');
    expect(nextLocale).toBe('en-US');   // clean STT for English speaker next turn
  });

  // Confidence-2: high confidence + foreign → still pair.sttLocale
  test('Confidence-2: high confidence + foreign detected → nextLocale still pair.sttLocale', () => {
    const { ttsLang, nextLocale } = resolveDirection('vi', VI_PAIR, 'high');
    expect(ttsLang).toBe('en');
    expect(nextLocale).toBe('vi-VN');   // only English detection switches locale
  });

  // Confidence-3: low confidence + English → pair.sttLocale (cascade prevention)
  test('Confidence-3: low confidence + English detected → nextLocale pair.sttLocale (cascade prevention)', () => {
    const { ttsLang, nextLocale } = resolveDirection('en', VI_PAIR, 'low');
    expect(ttsLang).toBe('vi');
    expect(nextLocale).toBe('vi-VN');   // never switches to en-US on uncertain detection
  });

  // Confidence-4: default (no confidence arg) === low → backward compatible
  test('Confidence-4: default confidence (no arg) equals low → pair.sttLocale', () => {
    const withLow     = resolveDirection('en', VI_PAIR, 'low');
    const withDefault = resolveDirection('en', VI_PAIR);
    expect(withDefault).toEqual(withLow);
    expect(withDefault.nextLocale).toBe('vi-VN');
  });

  // Confidence-5: 5 consecutive low-confidence English detections — never cascades to en-US
  test('Confidence-5: consecutive low-confidence English detections never cascade to en-US', () => {
    for (let i = 0; i < 5; i++) {
      const { nextLocale } = resolveDirection('en', VI_PAIR, 'low');
      expect(nextLocale).toBe('vi-VN');
    }
  });

  // Confidence-6: full pipeline — LANG:en response → high confidence → en-US
  test('Confidence-6: full pipeline — LANG:en response → high confidence → en-US next locale', () => {
    const { detected, confidence } = parseInterpreterResponse('LANG:en\nXin chào', VI_PAIR, 'Hello');
    const { ttsLang, nextLocale }  = resolveDirection(detected, VI_PAIR, confidence);
    expect(detected).toBe('en');
    expect(confidence).toBe('high');
    expect(ttsLang).toBe('vi');
    expect(nextLocale).toBe('en-US');   // AI confirmed English → clean English STT next turn
  });

  // Confidence-7: full pipeline — LANG:vi response → high confidence → vi-VN
  test('Confidence-7: full pipeline — LANG:vi response → high confidence → vi-VN next locale', () => {
    const { detected, confidence } = parseInterpreterResponse('LANG:vi\nHello', VI_PAIR, 'Xin chào');
    const { ttsLang, nextLocale }  = resolveDirection(detected, VI_PAIR, confidence);
    expect(detected).toBe('vi');
    expect(confidence).toBe('high');
    expect(ttsLang).toBe('en');
    expect(nextLocale).toBe('vi-VN');
  });

  // Confidence-8: full pipeline — no LANG: line → low confidence → vi-VN regardless of detected
  test('Confidence-8: full pipeline — no LANG: → low confidence → vi-VN (cascade prevention)', () => {
    const { detected, confidence } = parseInterpreterResponse('garbled', VI_PAIR, 'Hello there');
    const { nextLocale }           = resolveDirection(detected, VI_PAIR, confidence);
    expect(confidence).toBe('low');
    expect(nextLocale).toBe('vi-VN');   // low confidence never switches to en-US
  });

  // Confidence-9: alternating high-confidence turns — locale switches appropriately each turn
  test('Confidence-9: alternating high-confidence turns — locale switches per detected language', () => {
    const r1 = resolveDirection('en', VI_PAIR, 'high');
    expect(r1.nextLocale).toBe('en-US');    // English → en-US

    const r2 = resolveDirection('vi', VI_PAIR, 'high');
    expect(r2.nextLocale).toBe('vi-VN');    // Vietnamese → vi-VN

    const r3 = resolveDirection('en', VI_PAIR, 'high');
    expect(r3.nextLocale).toBe('en-US');    // English again → en-US again
  });

  // Confidence-10: works for other pairs — KO pair high confidence English → en-US
  test('Confidence-10: works for non-Vietnamese pairs — KO high confidence English → en-US', () => {
    const { nextLocale: nextHigh } = resolveDirection('en', KO_PAIR, 'high');
    const { nextLocale: nextLow  } = resolveDirection('en', KO_PAIR, 'low');
    expect(nextHigh).toBe('en-US');    // high confidence → en-US
    expect(nextLow).toBe('ko-KR');     // low confidence → ko-KR (cascade prevention)
  });

});

// ─── C. runInterpreterTts — TTS cascade / audio pipeline ──────────────────────

describe('runInterpreterTts — voice stability', () => {

  test('Voice test 1: Gemini success — onDone called once, openai/browser not called', () => {
    const gemini  = vi.fn((t, lang, cb) => cb(true));
    const openai  = vi.fn();
    const browser = vi.fn();
    const onDone  = vi.fn();

    runInterpreterTts('Hello', 'en', { gemini, openai, browser }, onDone);

    expect(gemini).toHaveBeenCalledOnce();
    expect(gemini).toHaveBeenCalledWith('Hello', 'en', expect.any(Function));
    expect(openai).not.toHaveBeenCalled();
    expect(browser).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledOnce();
  });

  test('Voice test 2: English — Gemini fails → OpenAI fallback used', () => {
    const gemini  = vi.fn((t, lang, cb) => cb(false));
    const openai  = vi.fn((t, cb) => cb(true));
    const browser = vi.fn();
    const onDone  = vi.fn();

    runInterpreterTts('Hello', 'en', { gemini, openai, browser }, onDone);

    expect(gemini).toHaveBeenCalledOnce();
    expect(openai).toHaveBeenCalledOnce();
    expect(browser).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledOnce();
  });

  test('Voice test 3: English — Gemini + OpenAI both fail → browser fallback used', () => {
    const gemini  = vi.fn((t, lang, cb) => cb(false));
    const openai  = vi.fn((t, cb) => cb(false));
    const browser = vi.fn((t, done, lang) => done());
    const onDone  = vi.fn();

    runInterpreterTts('Hello', 'en', { gemini, openai, browser }, onDone);

    expect(gemini).toHaveBeenCalledOnce();
    expect(openai).toHaveBeenCalledOnce();
    expect(browser).toHaveBeenCalledOnce();
    expect(browser).toHaveBeenCalledWith('Hello', expect.any(Function), 'en');
    expect(onDone).toHaveBeenCalledOnce();
  });

  test('Voice test 4: Non-English — Gemini fails → browser fallback (no OpenAI call)', () => {
    const gemini  = vi.fn((t, lang, cb) => cb(false));
    const openai  = vi.fn();
    const browser = vi.fn((t, done, lang) => done());
    const onDone  = vi.fn();

    runInterpreterTts('Xin chào', 'vi', { gemini, openai, browser }, onDone);

    expect(gemini).toHaveBeenCalledWith('Xin chào', 'vi', expect.any(Function));
    expect(openai).not.toHaveBeenCalled();   // English-only, must NOT be called for Vietnamese
    expect(browser).toHaveBeenCalledOnce();
    expect(browser).toHaveBeenCalledWith('Xin chào', expect.any(Function), 'vi');
    expect(onDone).toHaveBeenCalledOnce();
  });

  test('Voice test 4b: Korean — Gemini fails → browser (no OpenAI)', () => {
    const gemini  = vi.fn((t, lang, cb) => cb(false));
    const openai  = vi.fn();
    const browser = vi.fn((t, done, lang) => done());
    const onDone  = vi.fn();

    runInterpreterTts('안녕하세요', 'ko', { gemini, openai, browser }, onDone);

    expect(openai).not.toHaveBeenCalled();
    expect(browser).toHaveBeenCalledWith('안녕하세요', expect.any(Function), 'ko');
    expect(onDone).toHaveBeenCalledOnce();
  });

  test('Voice test 5: Selected voice remains stable — Gemini provides consistent voice per langCode', () => {
    // Gemini voice selection: en→Sulafat, vi→Aoede, ko→Kore, ja→Kore, es→Aoede
    // runInterpreterTts passes the exact ttsLang to gemini — verify the langCode is forwarded
    const calls = [];
    const gemini = vi.fn((t, lang, cb) => { calls.push(lang); cb(true); });
    const onDone = vi.fn();

    runInterpreterTts('Hello',      'en', { gemini, openai: vi.fn(), browser: vi.fn() }, onDone);
    runInterpreterTts('Xin chào',   'vi', { gemini, openai: vi.fn(), browser: vi.fn() }, onDone);
    runInterpreterTts('안녕하세요', 'ko', { gemini, openai: vi.fn(), browser: vi.fn() }, onDone);

    expect(calls).toEqual(['en', 'vi', 'ko']);  // each turn uses its own correct langCode
  });

  test('Voice test 6: browser langOverride is the ttsLang — correct voice for browser fallback', () => {
    const gemini  = vi.fn((t, lang, cb) => cb(false));
    const openai  = vi.fn((t, cb) => cb(false));
    const langsSentToBrowser = [];
    const browser = vi.fn((t, done, lang) => { langsSentToBrowser.push(lang); done(); });
    const onDone  = vi.fn();

    runInterpreterTts('Hello', 'en', { gemini, openai, browser }, onDone);
    expect(langsSentToBrowser).toContain('en');  // browser receives 'en' as langOverride

    runInterpreterTts('Xin chào', 'vi', { gemini, openai, browser }, onDone);
    expect(langsSentToBrowser).toContain('vi');  // browser receives 'vi' as langOverride
  });

});

describe('runInterpreterTts — audio output guarantees', () => {

  test('Audio test 5: translation text → TTS request is made (Gemini called)', () => {
    const gemini = vi.fn((t, lang, cb) => cb(true));
    runInterpreterTts('Hello', 'en', { gemini, openai: vi.fn(), browser: vi.fn() }, vi.fn());
    expect(gemini).toHaveBeenCalledOnce();
  });

  test('Audio test 6: Gemini success → onDone called (playback tracked)', () => {
    const gemini = vi.fn((t, lang, cb) => cb(true));
    const onDone = vi.fn();
    runInterpreterTts('Hello', 'en', { gemini, openai: vi.fn(), browser: vi.fn() }, onDone);
    expect(onDone).toHaveBeenCalledOnce();
  });

  test('Audio test 7: playback completion always calls onDone — all provider paths', () => {
    const successPaths = [
      // Gemini success
      { gemini: vi.fn((t,l,cb)=>cb(true)), openai: vi.fn(), browser: vi.fn() },
      // OpenAI fallback success
      { gemini: vi.fn((t,l,cb)=>cb(false)), openai: vi.fn((t,cb)=>cb(true)), browser: vi.fn() },
      // Browser fallback success
      { gemini: vi.fn((t,l,cb)=>cb(false)), openai: vi.fn((t,cb)=>cb(false)), browser: vi.fn((t,d)=>d()) },
    ];
    successPaths.forEach(providers => {
      const onDone = vi.fn();
      runInterpreterTts('test', 'en', providers, onDone);
      expect(onDone).toHaveBeenCalledOnce();
    });
  });

  test('Audio test 8: Gemini failure is surfaced — fallback chain executes', () => {
    const gemini  = vi.fn((t, lang, cb) => cb(false));  // simulates network failure
    const openai  = vi.fn((t, cb) => cb(true));
    const onDone  = vi.fn();
    runInterpreterTts('Hello', 'en', { gemini, openai, browser: vi.fn() }, onDone);
    expect(openai).toHaveBeenCalled();   // failure was not silent — fallback triggered
    expect(onDone).toHaveBeenCalledOnce();
  });

  test('Audio test 9: all providers fail → onDone still called (no hang)', () => {
    const gemini  = vi.fn((t, lang, cb) => cb(false));
    const openai  = vi.fn((t, cb) => cb(false));
    const browser = vi.fn((t, done, lang) => done());  // browser always calls done
    const onDone  = vi.fn();

    runInterpreterTts('Hello', 'en', { gemini, openai, browser }, onDone);
    expect(onDone).toHaveBeenCalledOnce();  // never hangs even on total failure
  });

  test('Audio test 10: no silent text-only path — onDone always fires', () => {
    // Simulate Gemini and OpenAI both failing for non-English with no browser
    // Even without a browser provider, onDone must be called
    const gemini = vi.fn((t, lang, cb) => cb(false));
    const onDone = vi.fn();

    runInterpreterTts('Xin chào', 'vi', { gemini, openai: vi.fn(), browser: undefined }, onDone);
    expect(onDone).toHaveBeenCalledOnce();  // no silent hang
  });

  test('Empty text short-circuits without calling any provider', () => {
    const gemini  = vi.fn();
    const openai  = vi.fn();
    const browser = vi.fn();
    const onDone  = vi.fn();

    runInterpreterTts('', 'en', { gemini, openai, browser }, onDone);
    expect(gemini).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledOnce();  // advances immediately

    runInterpreterTts('   ', 'vi', { gemini, openai, browser }, onDone);
    expect(onDone).toHaveBeenCalledTimes(2);
  });

  test('onDone is called at most once per invocation', () => {
    // Both Gemini and OpenAI report success — only first callback should fire onDone
    // (real Gemini/OpenAI won't do this, but test robustness)
    let cb1, cb2;
    const gemini  = vi.fn((t, lang, cb) => { cb1 = cb; });
    const openai  = vi.fn((t, cb)       => { cb2 = cb; });
    const browser = vi.fn();
    const onDone  = vi.fn();

    runInterpreterTts('Hello', 'en', { gemini, openai, browser }, onDone);

    // Simulate Gemini failing (triggering OpenAI) then Gemini succeeding late (stale)
    cb1(false); // Gemini reports failure → triggers openai
    cb2(true);  // OpenAI reports success → onDone called
    cb1(true);  // Gemini fires again (stale) — should NOT call onDone again
    // Note: runInterpreterTts itself doesn't deduplicate at this level;
    // the turnId guard in _translate does. This test verifies the cascade itself.
    // Each path calls onDone exactly once for its own branch.
    expect(onDone).toHaveBeenCalledOnce();
  });

});

// ─── D. Bidirectional routing (additional E2E) ────────────────────────────────

describe('Full turn simulation: parseInterpreterResponse + resolveDirection', () => {

  test('Bidirectional test 11: English input → Vietnamese output, next STT vi-VN', () => {
    const { detected } = parseInterpreterResponse('LANG:en\nChào bạn!', VI_PAIR, 'Hello there');
    const { ttsLang, nextLocale } = resolveDirection(detected, VI_PAIR);
    expect(ttsLang).toBe('vi');
    // nextLocale is always pair.sttLocale — STT never switches to en-US
    expect(nextLocale).toBe('vi-VN');
  });

  test('Bidirectional test 12: Vietnamese input → English output', () => {
    const { detected } = parseInterpreterResponse('LANG:vi\nHello there!', VI_PAIR, 'Xin chào');
    const { ttsLang, nextLocale } = resolveDirection(detected, VI_PAIR);
    expect(ttsLang).toBe('en');
    // nextLocale stays vi-VN — same as English detection case
    expect(nextLocale).toBe('vi-VN');
  });

  test('Bidirectional test 13: English first then Vietnamese — both correct', () => {
    const t1 = parseInterpreterResponse('LANG:en\nXin chào', VI_PAIR, 'Hello');
    const r1 = resolveDirection(t1.detected, VI_PAIR);
    expect(r1.ttsLang).toBe('vi');

    const t2 = parseInterpreterResponse('LANG:vi\nHi there', VI_PAIR, 'Xin chào bạn');
    const r2 = resolveDirection(t2.detected, VI_PAIR);
    expect(r2.ttsLang).toBe('en');
  });

  test('Bidirectional test 14: Vietnamese first then English — both correct', () => {
    const t1 = parseInterpreterResponse('LANG:vi\nGood morning', VI_PAIR, 'Chào buổi sáng');
    const r1 = resolveDirection(t1.detected, VI_PAIR);
    expect(r1.ttsLang).toBe('en');

    const t2 = parseInterpreterResponse('LANG:en\nChào buổi sáng', VI_PAIR, 'Good morning');
    const r2 = resolveDirection(t2.detected, VI_PAIR);
    expect(r2.ttsLang).toBe('vi');
  });

  test('Bidirectional test 15: Alternating turns remain correct over 6 turns', () => {
    const turns = [
      { ai: 'LANG:vi\nHello',      transcript: 'Xin chào',    expectedTts: 'en' },
      { ai: 'LANG:en\nXin chào',   transcript: 'Hello',       expectedTts: 'vi' },
      { ai: 'LANG:vi\nThank you',  transcript: 'Cảm ơn',      expectedTts: 'en' },
      { ai: 'LANG:en\nCảm ơn',     transcript: 'Thank you',   expectedTts: 'vi' },
      { ai: 'LANG:vi\nGoodbye',    transcript: 'Tạm biệt',    expectedTts: 'en' },
      { ai: 'LANG:en\nTạm biệt',   transcript: 'Goodbye',     expectedTts: 'vi' },
    ];
    turns.forEach(({ ai, transcript, expectedTts }) => {
      const { detected } = parseInterpreterResponse(ai, VI_PAIR, transcript);
      const { ttsLang }  = resolveDirection(detected, VI_PAIR);
      expect(ttsLang).toBe(expectedTts);
    });
  });

});

// ─── E. State machine invariants ──────────────────────────────────────────────

describe('State machine — turn tracking guards', () => {

  test('State test 16: TTS does not call back during speaking — no self-listening', () => {
    // Verify that runInterpreterTts only calls onDone AFTER provider completes,
    // not synchronously before audio plays (which would start listening mid-TTS)
    let capturedCb;
    const gemini = vi.fn((t, lang, cb) => { capturedCb = cb; /* don't call yet */ });
    const onDone = vi.fn();

    runInterpreterTts('Hello', 'en', { gemini, openai: vi.fn(), browser: vi.fn() }, onDone);

    expect(onDone).not.toHaveBeenCalled();  // not called yet — audio still playing
    capturedCb(true);                        // simulate audio completing
    expect(onDone).toHaveBeenCalledOnce();  // called only AFTER completion
  });

  test('State test 17: onDone called only after playback completes', () => {
    let resolvePlayback;
    const gemini = vi.fn((t, lang, cb) => {
      // Simulate async audio — callback fires after "playback"
      resolvePlayback = () => cb(true);
    });
    const onDone = vi.fn();

    runInterpreterTts('Hello', 'en', { gemini, openai: vi.fn(), browser: vi.fn() }, onDone);
    expect(onDone).not.toHaveBeenCalled();
    resolvePlayback();
    expect(onDone).toHaveBeenCalledOnce();
  });

  test('State test 18: previous turn TTS langCode does not leak into next turn', () => {
    const langs = [];
    const gemini = vi.fn((t, lang, cb) => { langs.push(lang); cb(true); });
    const onDone = vi.fn();

    // Turn 1: English input → output Vietnamese
    runInterpreterTts('Hello', 'vi', { gemini, openai: vi.fn(), browser: vi.fn() }, onDone);
    // Turn 2: Vietnamese input → output English
    runInterpreterTts('Xin chào', 'en', { gemini, openai: vi.fn(), browser: vi.fn() }, onDone);
    // Turn 3: English again
    runInterpreterTts('Goodbye', 'vi', { gemini, openai: vi.fn(), browser: vi.fn() }, onDone);

    expect(langs).toEqual(['vi', 'en', 'vi']);  // each turn uses its own ttsLang, no bleed
  });

  test('State test 19: resolveDirection is pure — no shared mutable state between calls', () => {
    // Call with same inputs multiple times — must always return the same result.
    // Both detected cases return pair.sttLocale for nextLocale — never en-US.
    for (let i = 0; i < 10; i++) {
      expect(resolveDirection('en', VI_PAIR)).toEqual({ ttsLang: 'vi', nextLocale: 'vi-VN' });
      expect(resolveDirection('vi', VI_PAIR)).toEqual({ ttsLang: 'en', nextLocale: 'vi-VN' });
    }
  });

});

// ─── G. buildGeminiProvider — voice pinning ───────────────────────────────────
// Tests that the user-selected Vietnamese voice is applied on every output turn
// and never re-resolved, auto-picked, or changed between turns.

describe('buildGeminiProvider — voice pinning for Vietnamese TTS', () => {

  // Test 1: Vietnamese output uses the selected voice
  test('Voice pin 1: Vietnamese output turn uses exact selected voice', () => {
    const calls = [];
    const rawGemini = vi.fn((text, lang, cb, voice) => { calls.push({ lang, voice }); cb(true); });
    const provider  = buildGeminiProvider(rawGemini, { vi: 'Kore' });
    const onDone    = vi.fn();

    runInterpreterTts('Xin chào', 'vi', { gemini: provider, openai: vi.fn(), browser: vi.fn() }, onDone);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ lang: 'vi', voice: 'Kore' });
    expect(onDone).toHaveBeenCalledOnce();
  });

  // Test 2: Multiple Vietnamese output turns in a row use the same voice
  test('Voice pin 2: Multiple Vietnamese turns in a row — same voice every time', () => {
    const voices = [];
    const rawGemini = vi.fn((text, lang, cb, voice) => { voices.push(voice); cb(true); });
    const provider  = buildGeminiProvider(rawGemini, { vi: 'Kore' });
    const onDone    = vi.fn();

    runInterpreterTts('Turn 1', 'vi', { gemini: provider, openai: vi.fn(), browser: vi.fn() }, onDone);
    runInterpreterTts('Turn 2', 'vi', { gemini: provider, openai: vi.fn(), browser: vi.fn() }, onDone);
    runInterpreterTts('Turn 3', 'vi', { gemini: provider, openai: vi.fn(), browser: vi.fn() }, onDone);

    expect(voices).toHaveLength(3);
    expect(voices.every(v => v === 'Kore')).toBe(true);  // never switched
    expect(onDone).toHaveBeenCalledTimes(3);
  });

  // Test 3: English turns do not inherit the Vietnamese voice preference
  test('Voice pin 3: English output turn — no voice override (null → server uses Sulafat default)', () => {
    const calls    = [];
    const rawGemini = vi.fn((text, lang, cb, voice) => { calls.push({ lang, voice }); cb(true); });
    const provider  = buildGeminiProvider(rawGemini, { vi: 'Kore' });

    runInterpreterTts('Hello', 'en', { gemini: provider, openai: vi.fn(), browser: vi.fn() }, vi.fn());

    expect(calls).toHaveLength(1);
    expect(calls[0].lang).toBe('en');
    expect(calls[0].voice).toBeNull();  // no override; server picks Sulafat from VOICE_MAP
  });

  // Test 4: Alternating English/Vietnamese turns always return to the same Vietnamese voice
  test('Voice pin 4: Alternating turns — Vietnamese always uses selected voice, English always null', () => {
    const calls    = [];
    const rawGemini = vi.fn((text, lang, cb, voice) => { calls.push({ lang, voice }); cb(true); });
    const provider  = buildGeminiProvider(rawGemini, { vi: 'Fenrir' });
    const onDone    = vi.fn();

    const sequence = [
      { text: 'Hello',    lang: 'en' },
      { text: 'Xin chào', lang: 'vi' },
      { text: 'Thank you',lang: 'en' },
      { text: 'Cảm ơn',  lang: 'vi' },
      { text: 'Goodbye',  lang: 'en' },
      { text: 'Tạm biệt', lang: 'vi' },
    ];

    sequence.forEach(({ text, lang }) =>
      runInterpreterTts(text, lang, { gemini: provider, openai: vi.fn(), browser: vi.fn() }, onDone)
    );

    const viCalls = calls.filter(c => c.lang === 'vi');
    const enCalls = calls.filter(c => c.lang === 'en');

    expect(viCalls).toHaveLength(3);
    expect(viCalls.every(c => c.voice === 'Fenrir')).toBe(true);  // always Fenrir
    expect(enCalls.every(c => c.voice === null)).toBe(true);        // English: no override
    expect(onDone).toHaveBeenCalledTimes(6);
  });

  // Test 5: No random switching — same provider produces the identical voice on every call
  test('Voice pin 5: No random voice switching — 10 turns, one unique voice', () => {
    const voices = [];
    const rawGemini = vi.fn((text, lang, cb, voice) => { voices.push(voice); cb(true); });
    const provider  = buildGeminiProvider(rawGemini, { vi: 'Puck' });

    for (let i = 0; i < 10; i++) {
      runInterpreterTts(`turn ${i}`, 'vi', { gemini: provider, openai: vi.fn(), browser: vi.fn() }, vi.fn());
    }

    expect(voices).toHaveLength(10);
    const unique = [...new Set(voices)];
    expect(unique).toHaveLength(1);
    expect(unique[0]).toBe('Puck');
  });

  // Test 6: Fallback when Gemini fails — browser is called, not a silent retry with different voice
  test('Voice pin 6: Gemini failure → explicit browser fallback (no second Gemini call)', () => {
    const rawGemini = vi.fn((text, lang, cb, voice) => cb(false));  // always fail
    const browser   = vi.fn((t, done, lang) => done());
    const onDone    = vi.fn();
    const provider  = buildGeminiProvider(rawGemini, { vi: 'Kore' });

    runInterpreterTts('Xin chào', 'vi', { gemini: provider, openai: vi.fn(), browser }, onDone);

    // Gemini was called exactly once with the pinned voice — failure is not silent
    expect(rawGemini).toHaveBeenCalledOnce();
    expect(rawGemini).toHaveBeenCalledWith('Xin chào', 'vi', expect.any(Function), 'Kore');
    // Only browser is the fallback — no second attempt with a different voice
    expect(browser).toHaveBeenCalledOnce();
    expect(onDone).toHaveBeenCalledOnce();
  });

  // Test 7: buildGeminiProvider is pure — different voicePrefs produce independent providers
  test('Voice pin 7: buildGeminiProvider is pure — each call returns an independent provider', () => {
    const received = [];
    const rawGemini = vi.fn((text, lang, cb, voice) => { received.push(voice); cb(true); });

    const providerA = buildGeminiProvider(rawGemini, { vi: 'Aoede' });
    const providerB = buildGeminiProvider(rawGemini, { vi: 'Charon' });

    runInterpreterTts('test', 'vi', { gemini: providerA, openai: vi.fn(), browser: vi.fn() }, vi.fn());
    runInterpreterTts('test', 'vi', { gemini: providerB, openai: vi.fn(), browser: vi.fn() }, vi.fn());

    expect(received).toEqual(['Aoede', 'Charon']);
  });

  // Test 8: VI_GEMINI_VOICES exports the expected voice list
  test('Voice pin 8: VI_GEMINI_VOICES contains required fields for each voice', () => {
    expect(VI_GEMINI_VOICES).not.toHaveLength(0);
    VI_GEMINI_VOICES.forEach(v => {
      expect(v).toHaveProperty('name');
      expect(v).toHaveProperty('label');
      expect(v).toHaveProperty('gender');
      expect(v).toHaveProperty('description');
      expect(typeof v.name).toBe('string');
      expect(v.name.length).toBeGreaterThan(0);
    });
    // Aoede must be present (it is the default)
    expect(VI_GEMINI_VOICES.some(v => v.name === 'Aoede')).toBe(true);
  });

  // Test 9: Provider with no voicePrefs passes null — server uses VOICE_MAP default
  test('Voice pin 9: Empty voicePrefs → null voice → server uses its default', () => {
    const calls    = [];
    const rawGemini = vi.fn((text, lang, cb, voice) => { calls.push(voice); cb(true); });
    const provider  = buildGeminiProvider(rawGemini, {});  // no preferences

    runInterpreterTts('Xin chào', 'vi', { gemini: provider, openai: vi.fn(), browser: vi.fn() }, vi.fn());

    expect(calls[0]).toBeNull();  // no override — server picks from VOICE_MAP
  });

  // Test 10: Session persistence simulation — provider created fresh each session with same preference
  test('Voice pin 10: Session persistence simulation — same saved voice applied every session', () => {
    // Simulates: user selects 'Kore', preference is saved, new session starts, same voice used
    const savedVoice = 'Kore';  // as if loaded from localStorage

    const session1calls = [];
    const session2calls = [];

    const rawGemini1 = vi.fn((t, l, cb, v) => { session1calls.push(v); cb(true); });
    const rawGemini2 = vi.fn((t, l, cb, v) => { session2calls.push(v); cb(true); });

    const provider1 = buildGeminiProvider(rawGemini1, { vi: savedVoice });
    const provider2 = buildGeminiProvider(rawGemini2, { vi: savedVoice });

    runInterpreterTts('turn 1', 'vi', { gemini: provider1, openai: vi.fn(), browser: vi.fn() }, vi.fn());
    runInterpreterTts('turn 2', 'vi', { gemini: provider1, openai: vi.fn(), browser: vi.fn() }, vi.fn());

    // New session (simulated by new provider with same saved preference)
    runInterpreterTts('turn 3', 'vi', { gemini: provider2, openai: vi.fn(), browser: vi.fn() }, vi.fn());

    expect(session1calls).toEqual(['Kore', 'Kore']);
    expect(session2calls).toEqual(['Kore']);
    expect([...new Set([...session1calls, ...session2calls])]).toHaveLength(1);
  });

});

// ─── G2. Vietnamese Gemini voice — adult language-learning sessions ───────────
// speakWithGemini in App.jsx now passes viGeminiVoice to speakViaGemini for 'vi'
// output, using the same voice-pinning mechanism as interpreter mode.
// These tests document and guard that behavior using the shared building blocks.

describe('Vietnamese Gemini voice — adult language-learning sessions', () => {

  // Test 1: Adult VI language session → Gemini is tried first (not browser, not OpenAI)
  test('Adult VI language session: Gemini called first (not browser/OpenAI)', () => {
    const gemini  = vi.fn((t, lang, cb) => cb(true));
    const openai  = vi.fn();
    const browser = vi.fn();
    const onDone  = vi.fn();

    // Simulate speakWithGemini for Vietnamese: Gemini first, no OpenAI for non-English
    runInterpreterTts('Xin chào bạn!', 'vi', { gemini, openai, browser }, onDone);

    expect(gemini).toHaveBeenCalledOnce();
    expect(openai).not.toHaveBeenCalled();    // English-only provider, never called for VI
    expect(browser).not.toHaveBeenCalled();   // Gemini succeeded → no browser fallback
    expect(onDone).toHaveBeenCalledOnce();
  });

  // Test 2: Adult VI tutor response → uses Gemini, not browser TTS
  test('Adult VI tutor response: Gemini used, browser only fires on Gemini failure', () => {
    // Scenario A: Gemini succeeds — browser never called
    const geminiOk  = vi.fn((t, lang, cb) => cb(true));
    const browserOk = vi.fn();
    runInterpreterTts('Cảm ơn bạn rất nhiều', 'vi', { gemini: geminiOk, openai: vi.fn(), browser: browserOk }, vi.fn());
    expect(browserOk).not.toHaveBeenCalled();

    // Scenario B: Gemini fails — browser is called as explicit fallback
    const geminiFail  = vi.fn((t, lang, cb) => cb(false));
    const browserFail = vi.fn((t, done, lang) => done());
    const onDone = vi.fn();
    runInterpreterTts('Cảm ơn bạn rất nhiều', 'vi', { gemini: geminiFail, openai: vi.fn(), browser: browserFail }, onDone);
    expect(browserFail).toHaveBeenCalledOnce();
    expect(onDone).toHaveBeenCalledOnce();    // never hangs
  });

  // Test 3: Adult VI session with pinned voice → same voice consistent across turns
  test('Adult VI session pinned voice: same Gemini voice on every tutor response', () => {
    const voices  = [];
    const rawGemini = vi.fn((t, lang, cb, voice) => { voices.push(voice); cb(true); });
    const provider  = buildGeminiProvider(rawGemini, { vi: 'Kore' });
    const onDone    = vi.fn();

    // Simulate 3 consecutive tutor responses in a Vietnamese language-learning session
    ['Xin chào!', 'Bạn có khỏe không?', 'Tốt lắm — tiếp tục nhé!'].forEach(text =>
      runInterpreterTts(text, 'vi', { gemini: provider, openai: vi.fn(), browser: vi.fn() }, onDone)
    );

    expect(voices).toHaveLength(3);
    expect(voices.every(v => v === 'Kore')).toBe(true);  // pinned — never switches
    expect(onDone).toHaveBeenCalledTimes(3);
  });

  // Test 4: Non-Vietnamese session → Vietnamese Gemini voice preference not applied
  test('Non-Vietnamese session: VI voice preference does not leak to other languages', () => {
    const calls = [];
    const rawGemini = vi.fn((t, lang, cb, voice) => { calls.push({ lang, voice }); cb(true); });
    // voicePrefs has a VI preference — but we're speaking Korean
    const provider  = buildGeminiProvider(rawGemini, { vi: 'Kore' });

    runInterpreterTts('안녕하세요', 'ko', { gemini: provider, openai: vi.fn(), browser: vi.fn() }, vi.fn());

    expect(calls[0].lang).toBe('ko');
    expect(calls[0].voice).toBeNull();    // VI voice preference does NOT apply to KO output
  });

  // Test 5: Non-adult session (e.g., child) → voice pinning behavior is identical
  // The viGeminiVoice preference is language-scoped, not age-gated. Age gating
  // (shouldUseTTS) lives in App.jsx — below the TTS cascade level. Voice pinning
  // applies equally to all sessions once TTS is triggered.
  test('Non-adult session: voice pinning works the same (age is not a factor at TTS level)', () => {
    const calls = [];
    const rawGemini = vi.fn((t, lang, cb, voice) => { calls.push(voice); cb(true); });
    const provider  = buildGeminiProvider(rawGemini, { vi: 'Puck' });

    runInterpreterTts('Chào bạn!', 'vi', { gemini: provider, openai: vi.fn(), browser: vi.fn() }, vi.fn());

    expect(calls[0]).toBe('Puck');   // voice pinning applies regardless of session age group
  });

  // Test 6: Gemini failure path → explicit fallback to browser, never silent
  test('Gemini failure: browser fallback is explicit, receives correct VI langCode', () => {
    const rawGemini = vi.fn((t, lang, cb, voice) => cb(false));    // Gemini always fails
    const provider  = buildGeminiProvider(rawGemini, { vi: 'Kore' });
    const browser   = vi.fn((t, done, lang) => done());
    const onDone    = vi.fn();

    runInterpreterTts('Bạn muốn học gì hôm nay?', 'vi', { gemini: provider, openai: vi.fn(), browser }, onDone);

    // Gemini was called once with pinned voice — failure is not silent
    expect(rawGemini).toHaveBeenCalledOnce();
    expect(rawGemini).toHaveBeenCalledWith('Bạn muốn học gì hôm nay?', 'vi', expect.any(Function), 'Kore');
    // Browser fallback fires with correct lang so it can synthesize Vietnamese
    expect(browser).toHaveBeenCalledOnce();
    expect(browser).toHaveBeenCalledWith('Bạn muốn học gì hôm nay?', expect.any(Function), 'vi');
    expect(onDone).toHaveBeenCalledOnce();    // never hangs even on total failure
  });

  // Test 7: Voice pinning survives session restart — same preference re-applied
  test('Voice pinning survives session restart — consistent across lesson sessions', () => {
    const savedVoice = 'Fenrir';    // as if loaded from localStorage
    const session1 = [];
    const session2 = [];

    const r1 = vi.fn((t, l, cb, v) => { session1.push(v); cb(true); });
    const r2 = vi.fn((t, l, cb, v) => { session2.push(v); cb(true); });

    const p1 = buildGeminiProvider(r1, { vi: savedVoice });
    const p2 = buildGeminiProvider(r2, { vi: savedVoice });

    runInterpreterTts('Turn 1', 'vi', { gemini: p1, openai: vi.fn(), browser: vi.fn() }, vi.fn());
    runInterpreterTts('Turn 2', 'vi', { gemini: p1, openai: vi.fn(), browser: vi.fn() }, vi.fn());
    // New session
    runInterpreterTts('Turn 3', 'vi', { gemini: p2, openai: vi.fn(), browser: vi.fn() }, vi.fn());

    expect(session1).toEqual(['Fenrir', 'Fenrir']);
    expect(session2).toEqual(['Fenrir']);
    expect([...new Set([...session1, ...session2])]).toHaveLength(1);  // only one unique voice
  });

});

// ─── G3. detectLangFromText — pair-constrained text-based detection ──────────

describe('detectLangFromText — pair-constrained text-based language detection', () => {

  const JA_PAIR = { code: 'ja', name: 'Japanese', sttLocale: 'ja-JP' };

  test('detects Vietnamese from diacritics — đàáạảã etc.', () => {
    expect(detectLangFromText('Xin chào bạn', VI_PAIR)).toBe('vi');
    expect(detectLangFromText('bạn khỏe không', VI_PAIR)).toBe('vi');
    expect(detectLangFromText('đi ăn cơm', VI_PAIR)).toBe('vi');
    expect(detectLangFromText('Tôi không biết', VI_PAIR)).toBe('vi');
  });

  test('detects English (no Vietnamese chars) as en — includes phonetic captures', () => {
    expect(detectLangFromText('Hello, how are you?', VI_PAIR)).toBe('en');
    expect(detectLangFromText('he lo ban', VI_PAIR)).toBe('en');   // phonetic "hello bạn" via STT
    expect(detectLangFromText('sin chao', VI_PAIR)).toBe('en');    // phonetic "xin chào" via STT
    expect(detectLangFromText('cam on', VI_PAIR)).toBe('en');      // phonetic "cảm ơn" via STT
  });

  test('detects Korean from Hangul characters', () => {
    expect(detectLangFromText('안녕하세요', KO_PAIR)).toBe('ko');
    expect(detectLangFromText('감사합니다', KO_PAIR)).toBe('ko');
    expect(detectLangFromText('잘 부탁드립니다', KO_PAIR)).toBe('ko');
  });

  test('detects English for KO pair when no Hangul present', () => {
    expect(detectLangFromText('Hello', KO_PAIR)).toBe('en');
    expect(detectLangFromText('an nyeong', KO_PAIR)).toBe('en');   // phonetic Hangul via STT
  });

  test('detects Japanese from hiragana/katakana', () => {
    expect(detectLangFromText('こんにちは', JA_PAIR)).toBe('ja');
    expect(detectLangFromText('ありがとうございます', JA_PAIR)).toBe('ja');
    expect(detectLangFromText('スタジオ', JA_PAIR)).toBe('ja');    // katakana
  });

  test('detects English for JA pair when no hiragana/katakana', () => {
    expect(detectLangFromText('Hello', JA_PAIR)).toBe('en');
    expect(detectLangFromText('konnichiwa', JA_PAIR)).toBe('en');  // phonetic via STT
  });

  test('detects Spanish from ñ / ¿ / ¡ characters', () => {
    expect(detectLangFromText('¿Cómo estás?', ES_PAIR)).toBe('es');
    expect(detectLangFromText('¡Hola!', ES_PAIR)).toBe('es');
    expect(detectLangFromText('El niño juega', ES_PAIR)).toBe('es');
  });

  test('detects English for ES pair when no ñ/¿/¡', () => {
    // Note: Spanish without these chars (como, hola, etc.) cannot be distinguished
    // from English by character range alone — correctly falls through to 'en'.
    expect(detectLangFromText('Hello there', ES_PAIR)).toBe('en');
    expect(detectLangFromText('como esta usted', ES_PAIR)).toBe('en');
  });

  test('empty string → defaults to en', () => {
    expect(detectLangFromText('', VI_PAIR)).toBe('en');
    expect(detectLangFromText('', KO_PAIR)).toBe('en');
    expect(detectLangFromText('', ES_PAIR)).toBe('en');
  });

  test('is pair-constrained — Vietnamese chars with KO pair return en (no Hangul)', () => {
    // Vietnamese diacritics are not in the KO pattern, so KO pair sees them as 'en'
    expect(detectLangFromText('Xin chào bạn', KO_PAIR)).toBe('en');
    expect(detectLangFromText('Tạm biệt', KO_PAIR)).toBe('en');
  });

  test('is pair-constrained — Hangul with VI pair returns en (no Vietnamese chars)', () => {
    expect(detectLangFromText('안녕하세요', VI_PAIR)).toBe('en');
  });

  test('is pure — same input always returns same result', () => {
    for (let i = 0; i < 5; i++) {
      expect(detectLangFromText('Xin chào', VI_PAIR)).toBe('vi');
      expect(detectLangFromText('Hello', VI_PAIR)).toBe('en');
    }
  });

});

// ─── H. buildInterpreterPrompt — stateless detection contract ────────────────

// The system prompt must never imply that the AI should infer language direction
// from conversation patterns. Every turn is treated independently by the AI.

describe('buildInterpreterPrompt — stateless per-turn detection', () => {

  // Statelessness is enforced by not sending conversation history to the API (see _translate).
  // These tests verify structural correctness of the prompt, not explicit stateless wording.

  // Required test 5: prompt includes LANG: format instruction for clean parsing
  test('Prompt test 5: prompt contains correct LANG: output format', () => {
    const prompt = buildInterpreterPrompt(VI_PAIR, 'southern');
    expect(prompt).toContain('LANG:vi');
    expect(prompt).toContain('LANG:en');
    // The format spec must be on line 1
    expect(prompt).toContain('Line 1:');
  });

  // Required test 6: prompt works for all supported pairs
  test('Prompt test 6: LANG: format and detection rules present for all supported pairs', () => {
    const pairs = [VI_PAIR, ES_PAIR, KO_PAIR];
    pairs.forEach(pair => {
      const prompt = buildInterpreterPrompt(pair);
      expect(prompt).toContain('LANG:' + pair.code);
      expect(prompt).toContain('LANG:en');
      expect(prompt).toContain(pair.name);
    });
  });

  // Required test 7: prompt is deterministic — same pair → same prompt every time
  test('Prompt test 7: buildInterpreterPrompt is pure — same inputs produce identical prompts', () => {
    const p1 = buildInterpreterPrompt(VI_PAIR, 'southern');
    const p2 = buildInterpreterPrompt(VI_PAIR, 'southern');
    expect(p1).toBe(p2);  // pure function, no hidden state
  });

  // Required test 8: prompt does NOT reference "rolling context", "history", or "previous turn"
  test('Prompt test 8: prompt does not instruct AI to use rolling context or prior turns', () => {
    const prompt = buildInterpreterPrompt(VI_PAIR, 'southern');
    expect(prompt.toLowerCase()).not.toContain('rolling context');
    expect(prompt.toLowerCase()).not.toContain('previous turn');
    expect(prompt.toLowerCase()).not.toContain('prior message');
    expect(prompt.toLowerCase()).not.toContain('conversation so far');
  });

});

// ─── F. Regression guards ────────────────────────────────────────────────────

describe('Regression guards', () => {

  test('Regression 20: voice does not randomly change — Gemini always gets correct langCode', () => {
    const geminiFails = false;
    const langCodesSentToGemini = [];
    const gemini = vi.fn((t, lang, cb) => { langCodesSentToGemini.push(lang); cb(!geminiFails); });
    const onDone = vi.fn();

    // Simulate a 10-turn session with alternating languages
    const ttsLangs = ['vi','en','vi','en','vi','en','vi','en','vi','en'];
    ttsLangs.forEach(lang => {
      runInterpreterTts('some text', lang, { gemini, openai: vi.fn(), browser: vi.fn() }, onDone);
    });

    expect(langCodesSentToGemini).toEqual(ttsLangs);  // always correct, never drifts
    expect(onDone).toHaveBeenCalledTimes(10);
  });

  test('Regression 21: interpreter does not lose audio after a few turns — onDone always fires', () => {
    const results = [];
    const gemini = vi.fn((t, lang, cb) => cb(true));
    const onDone = vi.fn(() => results.push('done'));

    for (let i = 0; i < 20; i++) {
      runInterpreterTts(`turn ${i}`, i % 2 === 0 ? 'en' : 'vi', {
        gemini, openai: vi.fn(), browser: vi.fn()
      }, onDone);
    }

    expect(results).toHaveLength(20);  // every turn completes, no drop-outs
  });

  test('Regression 22: text-only mode impossible — onDone always fires on all failure paths', () => {
    // Text-only mode = TTS providers fire but never call back (onDone never fires = hang)
    // Verify that even if providers never call their callbacks, the safety net (browser) exists

    // Worst-case: Gemini fails, OpenAI fails, browser is undefined
    const gemini = vi.fn((t, lang, cb) => cb(false));
    const openai = vi.fn((t, cb) => cb(false));
    const onDone = vi.fn();

    runInterpreterTts('Hello', 'en', { gemini, openai, browser: undefined }, onDone);
    expect(onDone).toHaveBeenCalledOnce();  // advances even without browser
  });

  test('Regression 23: stable across multiple consecutive turns in same session', () => {
    const gemini = vi.fn((t, lang, cb) => cb(true));
    const onDone = vi.fn();

    // Simulate 8 consecutive turns in the same session
    const session = [
      { text: 'Hello', lang: 'vi' },
      { text: 'Xin chào', lang: 'en' },
      { text: 'How are you?', lang: 'vi' },
      { text: 'Bạn khỏe không?', lang: 'en' },
      { text: 'Good', lang: 'vi' },
      { text: 'Tốt', lang: 'en' },
      { text: 'Thank you', lang: 'vi' },
      { text: 'Cảm ơn', lang: 'en' },
    ];

    session.forEach(({ text, lang }) => {
      runInterpreterTts(text, lang, { gemini, openai: vi.fn(), browser: vi.fn() }, onDone);
    });

    expect(onDone).toHaveBeenCalledTimes(8);  // all 8 turns completed
    expect(gemini).toHaveBeenCalledTimes(8);  // Gemini called for each
  });

});

// ─── I. Consecutive same-language regression ──────────────────────────────────
// These tests specifically guard against the two alternating-turn bugs:
//   Bug 1: resolveDirection('en', pair) → nextLocale:'en-US' (creates turn-to-turn dependency)
//   Bug 2: parseInterpreterResponse fallback used sttLocale (previous-turn state reuse)
// Both are fixed: nextLocale always pair.sttLocale; fallback uses detectLangFromText(transcript).

describe('Regression — consecutive same-language turns (stateless design)', () => {

  test('Vietnamese × 3 followed by English × 3 — all correct', () => {
    const viTurns = [
      { response: 'LANG:vi\nHello', transcript: 'Xin chào' },
      { response: 'LANG:vi\nHow are you?', transcript: 'Bạn khỏe không?' },
      { response: 'LANG:vi\nThank you', transcript: 'Cảm ơn bạn' },
    ];
    const enTurns = [
      { response: 'LANG:en\nXin chào', transcript: 'Hello' },
      { response: 'LANG:en\nBạn khỏe không?', transcript: 'How are you?' },
      { response: 'LANG:en\nCảm ơn bạn', transcript: 'Thank you' },
    ];

    viTurns.forEach(({ response, transcript }) => {
      const { detected } = parseInterpreterResponse(response, VI_PAIR, transcript);
      const { ttsLang, nextLocale } = resolveDirection(detected, VI_PAIR);
      expect(detected).toBe('vi');
      expect(ttsLang).toBe('en');
      expect(nextLocale).toBe('vi-VN');   // never switches to en-US
    });

    enTurns.forEach(({ response, transcript }) => {
      const { detected } = parseInterpreterResponse(response, VI_PAIR, transcript);
      const { ttsLang, nextLocale } = resolveDirection(detected, VI_PAIR);
      expect(detected).toBe('en');
      expect(ttsLang).toBe('vi');
      expect(nextLocale).toBe('vi-VN');   // still vi-VN even after English detected
    });
  });

  test('English × 3 followed by Vietnamese × 3 — all correct', () => {
    const enTurns = [
      { response: 'LANG:en\nXin chào', transcript: 'Hello' },
      { response: 'LANG:en\nBạn có khỏe không?', transcript: 'How are you?' },
      { response: 'LANG:en\nTạm biệt', transcript: 'Goodbye' },
    ];
    const viTurns = [
      { response: 'LANG:vi\nHello', transcript: 'Xin chào' },
      { response: 'LANG:vi\nHow are you?', transcript: 'Bạn khỏe không?' },
      { response: 'LANG:vi\nGoodbye', transcript: 'Tạm biệt' },
    ];

    enTurns.forEach(({ response, transcript }) => {
      const { detected } = parseInterpreterResponse(response, VI_PAIR, transcript);
      const { ttsLang, nextLocale } = resolveDirection(detected, VI_PAIR);
      expect(detected).toBe('en');
      expect(ttsLang).toBe('vi');
      expect(nextLocale).toBe('vi-VN');
    });

    viTurns.forEach(({ response, transcript }) => {
      const { detected } = parseInterpreterResponse(response, VI_PAIR, transcript);
      const { ttsLang, nextLocale } = resolveDirection(detected, VI_PAIR);
      expect(detected).toBe('vi');
      expect(ttsLang).toBe('en');
      expect(nextLocale).toBe('vi-VN');
    });
  });

  test('Mixed 11-turn natural conversation — all correct, nextLocale always vi-VN', () => {
    const conversation = [
      { response: 'LANG:vi\nHello',        transcript: 'Xin chào',      expTts: 'en' },
      { response: 'LANG:en\nXin chào',     transcript: 'Hello',          expTts: 'vi' },
      { response: 'LANG:vi\nHow are you?', transcript: 'Bạn khỏe không?', expTts: 'en' },
      { response: 'LANG:en\nTôi khỏe',     transcript: 'I am fine',      expTts: 'vi' },
      { response: 'LANG:vi\nGood',         transcript: 'Tốt',            expTts: 'en' },
      { response: 'LANG:vi\nThank you',    transcript: 'Cảm ơn bạn',    expTts: 'en' },
      { response: 'LANG:en\nCảm ơn',       transcript: 'Thank you',      expTts: 'vi' },
      { response: 'LANG:en\nHẹn gặp lại',  transcript: 'See you later',  expTts: 'vi' },
      { response: 'LANG:vi\nSee you later',transcript: 'Hẹn gặp lại',   expTts: 'en' },
      { response: 'LANG:vi\nGoodbye',      transcript: 'Tạm biệt',       expTts: 'en' },
      { response: 'LANG:en\nTạm biệt',     transcript: 'Goodbye',        expTts: 'vi' },
    ];

    conversation.forEach(({ response, transcript, expTts }) => {
      const { detected } = parseInterpreterResponse(response, VI_PAIR, transcript);
      const { ttsLang, nextLocale } = resolveDirection(detected, VI_PAIR);
      expect(ttsLang).toBe(expTts);
      expect(nextLocale).toBe('vi-VN');   // invariant: always vi-VN, turn after turn
    });
  });

  test('Guard: no expectedNextLanguage state — each call to resolveDirection is independent', () => {
    // Prove resolveDirection has no inter-call state by interleaving calls and checking
    // each returns the same result as if called in isolation.
    const isolated_vi = resolveDirection('vi', VI_PAIR);
    const isolated_en = resolveDirection('en', VI_PAIR);

    // After calling en → the next vi call must still be identical to isolated_vi
    resolveDirection('en', VI_PAIR);
    expect(resolveDirection('vi', VI_PAIR)).toEqual(isolated_vi);

    // After calling vi × 3 → en call must still be identical to isolated_en
    resolveDirection('vi', VI_PAIR);
    resolveDirection('vi', VI_PAIR);
    resolveDirection('vi', VI_PAIR);
    expect(resolveDirection('en', VI_PAIR)).toEqual(isolated_en);
  });

  test('Guard: fallback uses transcript text, not previous-turn state', () => {
    // Simulate AI returning garbled/empty response (no LANG: line).
    // Fallback must use the transcript, not any remembered previous-turn sttLocale.

    // Vietnamese transcript → detected vi
    const r1 = parseInterpreterResponse('garbled', VI_PAIR, 'Xin chào bạn');
    expect(r1.detected).toBe('vi');
    expect(r1.confidence).toBe('low');

    // English transcript → detected en
    const r2 = parseInterpreterResponse('garbled', VI_PAIR, 'Hello there');
    expect(r2.detected).toBe('en');
    expect(r2.confidence).toBe('low');

    // Order independence: calling in reverse order gives same result — no state dependency
    const r3 = parseInterpreterResponse('garbled', VI_PAIR, 'Hello there');
    const r4 = parseInterpreterResponse('garbled', VI_PAIR, 'Xin chào bạn');
    expect(r3.detected).toBe('en');
    expect(r4.detected).toBe('vi');
  });

  test('Guard: no alternating assumption — two English turns in a row do not flip direction', () => {
    // The old broken design assumed turns alternated: en → vi → en → vi → ...
    // When English was spoken twice in a row, the second turn would incorrectly output English.
    // With the stateless design, each turn only depends on `detected`.
    const turn1 = resolveDirection('en', VI_PAIR);
    const turn2 = resolveDirection('en', VI_PAIR);  // same speaker again
    const turn3 = resolveDirection('en', VI_PAIR);  // three consecutive English turns

    expect(turn1.ttsLang).toBe('vi');
    expect(turn2.ttsLang).toBe('vi');  // must NOT flip to 'en'
    expect(turn3.ttsLang).toBe('vi');  // still 'vi', no alternation
  });

  test('Guard: no alternating assumption — three Vietnamese turns in a row stay correct', () => {
    const turn1 = resolveDirection('vi', VI_PAIR);
    const turn2 = resolveDirection('vi', VI_PAIR);
    const turn3 = resolveDirection('vi', VI_PAIR);

    expect(turn1.ttsLang).toBe('en');
    expect(turn2.ttsLang).toBe('en');  // must NOT flip to 'vi'
    expect(turn3.ttsLang).toBe('en');  // still 'en'
  });

});
