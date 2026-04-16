// src/utils/interpreterBrain.test.js
//
// Tests for the rebuilt Vietnamese ↔ English interpreter brain.
//
// Architecture under test: TURN-LOCAL, STATELESS.
//   - detectViEn: per-turn language classification (no state)
//   - buildViEnPrompt: directed translation prompt (no detection in AI)
//   - resolveViEn: pure opposite-language function (no state)
//   - runInterpreterTts: TTS cascade with provider fallback
//   - buildGeminiProvider: voice-pinning factory

import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  detectViEn,
  buildViEnPrompt,
  resolveViEn,
  runInterpreterTts,
  buildGeminiProvider,
  VI_GEMINI_VOICES,
} from './interpreterBrain.js';

// ─── A. detectViEn — per-turn language classification ────────────────────────
//
// Core invariant: each call is independent.
// No cross-call state. Same input always returns same output.

describe('detectViEn — Vietnamese detection', () => {

  test('Detects Vietnamese from toned diacritics (high confidence)', () => {
    const r = detectViEn('Xin chào bạn');
    expect(r.lang).toBe('vi');
    expect(r.confidence).toBe('high');
  });

  test('Detects Vietnamese from ạ, ẹ, ộ, ớ (toned chars)', () => {
    expect(detectViEn('Tôi không biết').lang).toBe('vi');
    expect(detectViEn('Cảm ơn bạn rất nhiều').lang).toBe('vi');
    expect(detectViEn('Bạn có khỏe không?').lang).toBe('vi');
  });

  test('Detects Vietnamese from đ, ă, ơ, ư (structural chars)', () => {
    expect(detectViEn('Đi ăn cơm không').lang).toBe('vi');
    expect(detectViEn('được rồi').lang).toBe('vi');
  });

  test('Detects Vietnamese from common Vietnamese words', () => {
    expect(detectViEn('xin chào').lang).toBe('vi');
    expect(detectViEn('cảm ơn').lang).toBe('vi');
    expect(detectViEn('không có').lang).toBe('vi');
  });

  test('Detects Vietnamese sentence-final particles', () => {
    expect(detectViEn('được nhé').lang).toBe('vi');
    expect(detectViEn('vậy thôi').lang).toBe('vi');
  });

  test('Returns confidence high for clear Vietnamese', () => {
    expect(detectViEn('Xin chào, bạn có khỏe không?').confidence).toBe('high');
  });

});

describe('detectViEn — English detection', () => {

  test('Detects English from common English words (high confidence)', () => {
    const r = detectViEn('Hello, how are you?');
    expect(r.lang).toBe('en');
    expect(r.confidence).toBe('high');
  });

  test('Detects English: thank you, goodbye, please', () => {
    expect(detectViEn('Thank you very much').lang).toBe('en');
    expect(detectViEn('Goodbye, see you later').lang).toBe('en');
    expect(detectViEn('Please help me').lang).toBe('en');
  });

  test('Detects English: short common phrases', () => {
    expect(detectViEn('yes').lang).toBe('en');
    expect(detectViEn('okay sure').lang).toBe('en');
    expect(detectViEn('hi there').lang).toBe('en');
  });

  test('Detects English: "the" and other function words', () => {
    expect(detectViEn('the price is good').lang).toBe('en');
    expect(detectViEn('what color do you want').lang).toBe('en');
  });

});

describe('detectViEn — phonetic English through vi-VN STT', () => {

  // Key regression: "hê lô" for "hello" — ê and ô are BASE vowels (no tone mark).
  // These score +0.5 each = 1.0 total, which is below the 2.0 Vietnamese threshold.
  // Must be detected as English.
  test('CRITICAL: "hê lô" (phonetic hello) detected as English', () => {
    const r = detectViEn('hê lô');
    expect(r.lang).toBe('en');
  });

  test('Pure ASCII phonetic English detected as English', () => {
    expect(detectViEn('he lo ban').lang).toBe('en');
    expect(detectViEn('sin chao').lang).toBe('en');
    expect(detectViEn('cam on').lang).toBe('en');
    expect(detectViEn('bye bye').lang).toBe('en');
  });

  test('Empty string defaults to English (low confidence)', () => {
    const r = detectViEn('');
    expect(r.lang).toBe('en');
    expect(r.confidence).toBe('low');
  });

});

describe('detectViEn — statelessness and purity', () => {

  // Core architecture guarantee: no state between calls
  test('Same input always returns identical output (pure function)', () => {
    for (let i = 0; i < 5; i++) {
      expect(detectViEn('Xin chào bạn')).toEqual(detectViEn('Xin chào bạn'));
      expect(detectViEn('Hello there')).toEqual(detectViEn('Hello there'));
    }
  });

  test('Interleaved calls do not affect each other', () => {
    const vi1 = detectViEn('Xin chào');
    detectViEn('Hello');  // intervening English call
    const vi2 = detectViEn('Xin chào');  // same input as vi1
    expect(vi1).toEqual(vi2);  // must be identical
  });

  test('No shared mutable state — 20 alternating calls are all independent', () => {
    const results = Array.from({ length: 20 }, (_, i) =>
      detectViEn(i % 2 === 0 ? 'Xin chào bạn' : 'Hello there').lang
    );
    const expected = Array.from({ length: 20 }, (_, i) => i % 2 === 0 ? 'vi' : 'en');
    expect(results).toEqual(expected);
  });

  test('Returns reason string in every case', () => {
    expect(detectViEn('Xin chào').reason).toBeTruthy();
    expect(detectViEn('Hello').reason).toBeTruthy();
    expect(detectViEn('').reason).toBeTruthy();
    expect(detectViEn('hê lô').reason).toBeTruthy();
  });

});

// ─── B. resolveViEn — direction resolution ────────────────────────────────────
//
// Core invariant: always returns the OPPOSITE language. No state. No memory.

describe('resolveViEn — stateless direction resolution', () => {

  test('Vietnamese input → English output', () => {
    expect(resolveViEn('vi')).toBe('en');
  });

  test('English input → Vietnamese output', () => {
    expect(resolveViEn('en')).toBe('vi');
  });

  test('Vietnamese × 3 in a row → English output all 3 times', () => {
    expect(resolveViEn('vi')).toBe('en');
    expect(resolveViEn('vi')).toBe('en');
    expect(resolveViEn('vi')).toBe('en');
  });

  test('English × 3 in a row → Vietnamese output all 3 times', () => {
    expect(resolveViEn('en')).toBe('vi');
    expect(resolveViEn('en')).toBe('vi');
    expect(resolveViEn('en')).toBe('vi');
  });

  test('Alternating turns always correct', () => {
    const inputs   = ['vi', 'en', 'vi', 'en', 'vi', 'en'];
    const expected = ['en', 'vi', 'en', 'vi', 'en', 'vi'];
    inputs.forEach((lang, i) => {
      expect(resolveViEn(lang)).toBe(expected[i]);
    });
  });

  test('No lock-in — each call fully independent', () => {
    expect(resolveViEn('en')).toBe('vi');
    expect(resolveViEn('en')).toBe('vi');
    expect(resolveViEn('vi')).toBe('en');
    expect(resolveViEn('en')).toBe('vi');
    expect(resolveViEn('vi')).toBe('en');
    expect(resolveViEn('vi')).toBe('en');
  });

  test('No alternating assumption — 20 calls all deterministic', () => {
    const results = Array.from({ length: 20 }, (_, i) =>
      resolveViEn(i % 2 === 0 ? 'vi' : 'en')
    );
    const expected = Array.from({ length: 20 }, (_, i) => i % 2 === 0 ? 'en' : 'vi');
    expect(results).toEqual(expected);
  });

  test('Pure function — no shared mutable state', () => {
    // Interleave vi and en calls — result must be deterministic regardless of order
    const isolated_vi = resolveViEn('vi');
    const isolated_en = resolveViEn('en');

    resolveViEn('en');
    expect(resolveViEn('vi')).toBe(isolated_vi);  // unchanged after en call

    resolveViEn('vi');
    resolveViEn('vi');
    resolveViEn('vi');
    expect(resolveViEn('en')).toBe(isolated_en);  // unchanged after vi × 3 calls
  });

});

// ─── C. Full turn pipeline: detectViEn + resolveViEn ─────────────────────────
//
// Tests the complete per-turn logic: classify → resolve → output language.
// This is what _translate does on every turn, independently.

describe('Full turn pipeline — Vietnamese × N turns', () => {

  test('Req 1: Vietnamese spoken once → English output', () => {
    const { lang } = detectViEn('Xin chào bạn');
    expect(lang).toBe('vi');
    expect(resolveViEn(lang)).toBe('en');
  });

  test('Req 2: Vietnamese spoken twice in a row → English output BOTH times', () => {
    const turn1 = detectViEn('Xin chào bạn');
    const turn2 = detectViEn('Bạn có khỏe không?');
    expect(resolveViEn(turn1.lang)).toBe('en');
    expect(resolveViEn(turn2.lang)).toBe('en');
  });

  test('Req 3: Vietnamese spoken three times in a row → English output ALL THREE', () => {
    const transcripts = ['Xin chào', 'Cảm ơn bạn', 'Tôi không biết'];
    transcripts.forEach(t => {
      const { lang } = detectViEn(t);
      expect(lang).toBe('vi');
      expect(resolveViEn(lang)).toBe('en');
    });
  });

});

describe('Full turn pipeline — English × N turns', () => {

  test('Req 4: English spoken once → Vietnamese output', () => {
    const { lang } = detectViEn('Hello, how are you?');
    expect(lang).toBe('en');
    expect(resolveViEn(lang)).toBe('vi');
  });

  test('Req 5: English spoken twice in a row → Vietnamese output BOTH times', () => {
    const turn1 = detectViEn('Hello, how are you?');
    const turn2 = detectViEn('Thank you very much');
    expect(resolveViEn(turn1.lang)).toBe('vi');
    expect(resolveViEn(turn2.lang)).toBe('vi');
  });

  test('Req 6: English spoken three times in a row → Vietnamese output ALL THREE', () => {
    const transcripts = ['Hello', 'Thank you', 'Goodbye, see you later'];
    transcripts.forEach(t => {
      const { lang } = detectViEn(t);
      expect(lang).toBe('en');
      expect(resolveViEn(lang)).toBe('vi');
    });
  });

});

describe('Full turn pipeline — mixed natural conversation', () => {

  test('Req 7-11: Natural 11-turn conversation — all turns correct', () => {
    const conversation = [
      { transcript: 'Xin chào bạn',          expectedSrc: 'vi', expectedOut: 'en' }, // 7
      { transcript: 'Xin chào bạn lần nữa',  expectedSrc: 'vi', expectedOut: 'en' }, // 8 (vi again)
      { transcript: 'Hello there',            expectedSrc: 'en', expectedOut: 'vi' }, // 9
      { transcript: 'How are you?',           expectedSrc: 'en', expectedOut: 'vi' }, // 10 (en again)
      { transcript: 'Tôi khỏe, cảm ơn bạn',  expectedSrc: 'vi', expectedOut: 'en' }, // 11
    ];

    conversation.forEach(({ transcript, expectedSrc, expectedOut }, i) => {
      const { lang } = detectViEn(transcript);
      const out = resolveViEn(lang);
      expect(lang).toBe(expectedSrc);
      expect(out).toBe(expectedOut);
    });
  });

  test('Req 12: English first → works correctly (no warmup needed)', () => {
    // The old design sometimes needed a Vi turn first. New design has no such requirement.
    const { lang } = detectViEn('Hello, I need help');
    expect(lang).toBe('en');
    expect(resolveViEn(lang)).toBe('vi');
  });

  test('Req 13: Vietnamese first → works correctly', () => {
    const { lang } = detectViEn('Xin chào, tôi cần giúp đỡ');
    expect(lang).toBe('vi');
    expect(resolveViEn(lang)).toBe('en');
  });

  test('Req 14: Same speaker twice in a row → both turns correct', () => {
    // Vietnamese speaker says two things back to back
    const t1 = detectViEn('Bao nhiêu tiền?');
    const t2 = detectViEn('Được rồi, cảm ơn');
    expect(resolveViEn(t1.lang)).toBe('en');
    expect(resolveViEn(t2.lang)).toBe('en');

    // English speaker says two things back to back
    const t3 = detectViEn('How much does it cost?');
    const t4 = detectViEn('Okay, thank you');
    expect(resolveViEn(t3.lang)).toBe('vi');
    expect(resolveViEn(t4.lang)).toBe('vi');
  });

});

// ─── D. Architecture guards ───────────────────────────────────────────────────
//
// These tests verify the architecture properties, not just behavior.

describe('Architecture guard — no expected-next-language state', () => {

  test('Req 15: No alternating-turn assumption in resolveViEn', () => {
    // In the old design, two consecutive En turns would eventually break.
    // With resolveViEn, each call is independent.
    const t1 = resolveViEn('en');
    const t2 = resolveViEn('en');  // same speaker again
    const t3 = resolveViEn('en');  // third time
    expect(t1).toBe('vi');
    expect(t2).toBe('vi');  // must NOT flip to 'en'
    expect(t3).toBe('vi');  // still 'vi'
  });

  test('Req 16: No expected-next-language — resolveViEn result after vi is NOT used as input to next call', () => {
    // After resolving 'vi' → 'en', the next call to resolveViEn must still take
    // its own explicit input, not "remember" that 'en' was the last output.
    resolveViEn('vi');  // returns 'en' — but this return value is NOT stored
    // The very next call with 'vi' must still return 'en', not 'vi' (no toggle)
    expect(resolveViEn('vi')).toBe('en');
  });

  test('Req 17: No toggle-based direction logic', () => {
    // Toggle would mean: vi→en, en→vi, vi→en, en→vi, ... (alternating outputs)
    // But our design is: output = opposite(input), NOT opposite(previous_output)
    // Both vi inputs must produce 'en', regardless of what's "next" in a toggle
    expect(resolveViEn('vi')).toBe('en');
    expect(resolveViEn('vi')).toBe('en');  // toggle would return 'vi' here — wrong
    expect(resolveViEn('en')).toBe('vi');
    expect(resolveViEn('vi')).toBe('en');
  });

  test('Req 18: Previous turn language cannot override current turn', () => {
    // Simulate: turn 1 detected 'en', then turn 2 is also 'en'
    // A broken design would "override" turn 2 to 'vi' because the previous was 'en'
    const prevResult = detectViEn('Hello');   // turn 1: en
    const currResult = detectViEn('Thank you');  // turn 2: also en

    // Both must resolve to Vietnamese output
    expect(resolveViEn(prevResult.lang)).toBe('vi');
    expect(resolveViEn(currResult.lang)).toBe('vi');

    // Confirm they are independent — prevResult does NOT affect currResult
    expect(currResult.lang).toBe('en');  // not overridden by previous turn
  });

  test('Req 19: Turn-local routing state resets after every turn', () => {
    // In _translate, sourceLang and ttsLang are local variables.
    // They cannot persist because they're not stored in any ref or state.
    // We verify this at the API level: detectViEn and resolveViEn have no module state.

    // Run 10 turns with different inputs — each is fully independent
    const inputs = [
      { transcript: 'Xin chào', expectedSrc: 'vi' },
      { transcript: 'Hello',    expectedSrc: 'en' },
      { transcript: 'Xin chào', expectedSrc: 'vi' },
      { transcript: 'Hello',    expectedSrc: 'en' },
      { transcript: 'Xin chào', expectedSrc: 'vi' },
      { transcript: 'Hello',    expectedSrc: 'en' },
      { transcript: 'Xin chào', expectedSrc: 'vi' },
      { transcript: 'Hello',    expectedSrc: 'en' },
      { transcript: 'Xin chào', expectedSrc: 'vi' },
      { transcript: 'Hello',    expectedSrc: 'en' },
    ];

    inputs.forEach(({ transcript, expectedSrc }) => {
      const { lang } = detectViEn(transcript);
      expect(lang).toBe(expectedSrc);  // each turn correct, independent
    });
  });

});

// ─── E. runInterpreterTts — TTS cascade ───────────────────────────────────────

describe('runInterpreterTts — provider cascade', () => {

  test('Gemini success → onDone called once, no fallback', () => {
    const gemini  = vi.fn((t, lang, cb) => cb(true));
    const openai  = vi.fn();
    const browser = vi.fn();
    const onDone  = vi.fn();

    runInterpreterTts('Hello', 'en', { gemini, openai, browser }, onDone);

    expect(gemini).toHaveBeenCalledOnce();
    expect(openai).not.toHaveBeenCalled();
    expect(browser).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledOnce();
  });

  test('English: Gemini fails → OpenAI fallback', () => {
    const gemini  = vi.fn((t, lang, cb) => cb(false));
    const openai  = vi.fn((t, cb) => cb(true));
    const browser = vi.fn();
    const onDone  = vi.fn();

    runInterpreterTts('Hello', 'en', { gemini, openai, browser }, onDone);

    expect(openai).toHaveBeenCalledOnce();
    expect(browser).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledOnce();
  });

  test('English: Gemini + OpenAI both fail → browser fallback', () => {
    const gemini  = vi.fn((t, lang, cb) => cb(false));
    const openai  = vi.fn((t, cb) => cb(false));
    const browser = vi.fn((t, done, lang) => done());
    const onDone  = vi.fn();

    runInterpreterTts('Hello', 'en', { gemini, openai, browser }, onDone);

    expect(browser).toHaveBeenCalledWith('Hello', expect.any(Function), 'en');
    expect(onDone).toHaveBeenCalledOnce();
  });

  test('Vietnamese: Gemini fails → browser (NO OpenAI — English-only voice)', () => {
    const gemini  = vi.fn((t, lang, cb) => cb(false));
    const openai  = vi.fn();
    const browser = vi.fn((t, done, lang) => done());
    const onDone  = vi.fn();

    runInterpreterTts('Xin chào', 'vi', { gemini, openai, browser }, onDone);

    expect(openai).not.toHaveBeenCalled();  // CRITICAL: OpenAI skipped for vi
    expect(browser).toHaveBeenCalledWith('Xin chào', expect.any(Function), 'vi');
    expect(onDone).toHaveBeenCalledOnce();
  });

  test('Empty text → onDone immediately, no provider calls', () => {
    const gemini = vi.fn();
    const onDone = vi.fn();

    runInterpreterTts('', 'en', { gemini, openai: vi.fn(), browser: vi.fn() }, onDone);
    runInterpreterTts('   ', 'vi', { gemini, openai: vi.fn(), browser: vi.fn() }, onDone);

    expect(gemini).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(2);
  });

  test('onDone called at most once per invocation (settle guard)', () => {
    let geminiCb, openaiCb;
    const gemini  = vi.fn((t, lang, cb) => { geminiCb = cb; });
    const openai  = vi.fn((t, cb)       => { openaiCb = cb; });
    const onDone  = vi.fn();

    runInterpreterTts('Hello', 'en', { gemini, openai, browser: vi.fn() }, onDone);
    geminiCb(false);  // Gemini fails → triggers openai
    openaiCb(true);   // OpenAI succeeds → onDone
    geminiCb(true);   // Gemini fires again (stale) — must NOT call onDone again

    expect(onDone).toHaveBeenCalledOnce();
  });

  test('All providers fail (no browser) → onDone still called (no hang)', () => {
    const gemini = vi.fn((t, lang, cb) => cb(false));
    const openai = vi.fn((t, cb) => cb(false));
    const onDone = vi.fn();

    runInterpreterTts('Hello', 'en', { gemini, openai, browser: undefined }, onDone);
    expect(onDone).toHaveBeenCalledOnce();
  });

  test('onDone fires after 20 alternating turns — no drop-outs', () => {
    const gemini = vi.fn((t, lang, cb) => cb(true));
    const onDone = vi.fn();

    for (let i = 0; i < 20; i++) {
      runInterpreterTts(`turn ${i}`, i % 2 === 0 ? 'en' : 'vi', {
        gemini, openai: vi.fn(), browser: vi.fn()
      }, onDone);
    }

    expect(onDone).toHaveBeenCalledTimes(20);
  });

});

// ─── F. buildGeminiProvider — voice pinning ────────────────────────────────────

describe('buildGeminiProvider — Vietnamese voice pinning', () => {

  test('Vietnamese output uses pinned voice', () => {
    const calls = [];
    const raw   = vi.fn((t, lang, cb, voice) => { calls.push({ lang, voice }); cb(true); });
    const p     = buildGeminiProvider(raw, { vi: 'Kore' });

    runInterpreterTts('Xin chào', 'vi', { gemini: p, openai: vi.fn(), browser: vi.fn() }, vi.fn());

    expect(calls[0]).toEqual({ lang: 'vi', voice: 'Kore' });
  });

  test('English output uses null voice (server default)', () => {
    const calls = [];
    const raw   = vi.fn((t, lang, cb, voice) => { calls.push({ lang, voice }); cb(true); });
    const p     = buildGeminiProvider(raw, { vi: 'Kore' });

    runInterpreterTts('Hello', 'en', { gemini: p, openai: vi.fn(), browser: vi.fn() }, vi.fn());

    expect(calls[0].lang).toBe('en');
    expect(calls[0].voice).toBeNull();
  });

  test('Vietnamese voice is stable across 5 consecutive VI turns', () => {
    const voices = [];
    const raw    = vi.fn((t, lang, cb, voice) => { voices.push(voice); cb(true); });
    const p      = buildGeminiProvider(raw, { vi: 'Fenrir' });

    for (let i = 0; i < 5; i++) {
      runInterpreterTts(`turn ${i}`, 'vi', { gemini: p, openai: vi.fn(), browser: vi.fn() }, vi.fn());
    }

    expect(voices).toHaveLength(5);
    expect([...new Set(voices)]).toHaveLength(1);
    expect(voices[0]).toBe('Fenrir');
  });

  test('Empty voicePrefs → null voice for all langs', () => {
    const voices = [];
    const raw    = vi.fn((t, lang, cb, voice) => { voices.push(voice); cb(true); });
    const p      = buildGeminiProvider(raw, {});

    runInterpreterTts('Xin chào', 'vi', { gemini: p, openai: vi.fn(), browser: vi.fn() }, vi.fn());
    expect(voices[0]).toBeNull();
  });

  test('VI_GEMINI_VOICES has required fields and includes Aoede (default)', () => {
    expect(VI_GEMINI_VOICES.length).toBeGreaterThan(0);
    VI_GEMINI_VOICES.forEach(v => {
      expect(v).toHaveProperty('name');
      expect(v).toHaveProperty('label');
      expect(v).toHaveProperty('gender');
      expect(v).toHaveProperty('description');
    });
    expect(VI_GEMINI_VOICES.some(v => v.name === 'Aoede')).toBe(true);
  });

});

// ─── G. buildViEnPrompt — directed translation prompt ─────────────────────────

describe('buildViEnPrompt — prompt structure', () => {

  test('vi→en prompt names Vietnamese as source and English as target', () => {
    const p = buildViEnPrompt('vi');
    expect(p).toContain('Vietnamese');
    expect(p).toContain('English');
    expect(p).toContain('Vietnamese → English');
  });

  test('en→vi prompt names English as source and Vietnamese as target', () => {
    const p = buildViEnPrompt('en');
    expect(p).toContain('English');
    expect(p).toContain('Vietnamese');
    expect(p).toContain('English → Vietnamese');
  });

  test('en→vi prompt includes dialect note for southern (default)', () => {
    const p = buildViEnPrompt('en', 'southern');
    expect(p).toContain('Southern Vietnamese');
  });

  test('en→vi prompt includes dialect note for northern', () => {
    const p = buildViEnPrompt('en', 'northern');
    expect(p).toContain('Northern Vietnamese');
  });

  test('vi→en prompt is pure: same inputs produce identical output', () => {
    expect(buildViEnPrompt('vi')).toBe(buildViEnPrompt('vi'));
    expect(buildViEnPrompt('en', 'southern')).toBe(buildViEnPrompt('en', 'southern'));
  });

  test('prompt does not ask AI to detect language (no LANG: format)', () => {
    const pViEn = buildViEnPrompt('vi');
    const pEnVi = buildViEnPrompt('en');
    // The new design: AI translates only, does NOT detect
    expect(pViEn).not.toContain('LANG:');
    expect(pEnVi).not.toContain('LANG:');
    expect(pViEn).not.toContain('detect');
    expect(pEnVi).not.toContain('detect');
  });

  test('prompt instructs AI to output ONLY the translation', () => {
    const p = buildViEnPrompt('vi');
    expect(p).toContain('ONLY');  // "Output ONLY the translation"
  });

});

// ─── H. Regression: consecutive same-language turns ──────────────────────────

describe('Regression — consecutive same-language turns (stateless correctness)', () => {

  test('Vietnamese × 3 → English × 3: all 6 turns correct', () => {
    const viTurns = [
      'Xin chào bạn',
      'Bạn có khỏe không?',
      'Cảm ơn rất nhiều',
    ];
    const enTurns = [
      'Hello there',
      'How are you?',
      'Thank you so much',
    ];

    viTurns.forEach(t => {
      const { lang } = detectViEn(t);
      expect(lang).toBe('vi');
      expect(resolveViEn(lang)).toBe('en');
    });

    enTurns.forEach(t => {
      const { lang } = detectViEn(t);
      expect(lang).toBe('en');
      expect(resolveViEn(lang)).toBe('vi');
    });
  });

  test('English × 3 → Vietnamese × 3: all 6 turns correct', () => {
    const enFirst  = ['Hello', 'How are you?', 'Goodbye'];
    const viSecond = ['Xin chào', 'Bạn khỏe không?', 'Tạm biệt'];

    enFirst.forEach(t => {
      expect(resolveViEn(detectViEn(t).lang)).toBe('vi');
    });
    viSecond.forEach(t => {
      expect(resolveViEn(detectViEn(t).lang)).toBe('en');
    });
  });

  test('No alternating assumption — English twice in a row both produce Vietnamese output', () => {
    const t1 = resolveViEn(detectViEn('Hello how are you').lang);
    const t2 = resolveViEn(detectViEn('Thank you very much').lang);
    expect(t1).toBe('vi');
    expect(t2).toBe('vi');  // must NOT flip to 'en'
  });

  test('No alternating assumption — Vietnamese twice in a row both produce English output', () => {
    const t1 = resolveViEn(detectViEn('Xin chào bạn').lang);
    const t2 = resolveViEn(detectViEn('Cảm ơn rất nhiều').lang);
    expect(t1).toBe('en');
    expect(t2).toBe('en');  // must NOT flip to 'vi'
  });

});
