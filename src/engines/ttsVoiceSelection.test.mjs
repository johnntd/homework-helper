/**
 * TTS Voice Selection Tests
 *
 * Verifies that the voice selection logic correctly separates
 * output language from user profile language.
 */

import { getVietnameseVoice } from './languageEngine.js';

// === Mock voice list (simulates a Vietnamese device) ===
const MOCK_VOICES = [
  { name: 'Linh', lang: 'vi-VN' },           // Vietnamese voice (often voices[0] on Vi devices)
  { name: 'Samantha', lang: 'en-US' },        // English voice
  { name: 'Google US English', lang: 'en-US' },
  { name: 'Karen', lang: 'en-AU' },
  { name: 'Google tiếng Việt', lang: 'vi-VN' },
  { name: 'Kyoko', lang: 'ja-JP' },
];

// === Helper: simulates the voice selection logic from speak() ===
function selectVoice(voices, voiceLang, langOverride, userLang, viAccent = 'southern') {
  const LANGUAGE_LOCALE_MAP = {
    'en': 'en-US', 'vi': 'vi-VN', 'ja': 'ja-JP', 'ko': 'ko-KR', 'zh': 'zh-CN',
  };
  const languageVoiceMap = {
    'en': ['Samantha', 'Karen', 'Ava', 'Google US English'],
    'vi': ['Linh', 'Google tiếng Việt'],
  };

  const targetLangPrefix = voiceLang === 'zh' ? 'zh-' : voiceLang;
  const preferredVoiceNames = languageVoiceMap[voiceLang] || [];
  let selectedVoice = null;

  // Pass 1: Named voice preferences — must match target language
  for (const vn of preferredVoiceNames) {
    selectedVoice = voices.find(v =>
      v.name.toLowerCase().includes(vn.toLowerCase()) &&
      v.lang.startsWith(targetLangPrefix)
    );
    if (selectedVoice) break;
  }

  // Pass 2: Enhanced/Premium
  if (!selectedVoice) {
    selectedVoice = voices.find(v =>
      v.lang.startsWith(targetLangPrefix) &&
      (v.name.includes('Enhanced') || v.name.includes('Premium'))
    );
  }

  // Pass 3: Vietnamese accent-aware
  if (!selectedVoice && voiceLang === 'vi') {
    selectedVoice = getVietnameseVoice(voices, viAccent);
  }

  // Pass 4: Any voice matching target language
  if (!selectedVoice) {
    const targetLocale = LANGUAGE_LOCALE_MAP[voiceLang] || 'en-US';
    selectedVoice = voices.find(v => v.lang === targetLocale)
      || voices.find(v => v.lang.startsWith(targetLangPrefix));
  }

  // Pass 5: Fallback for English — only if voices[0] is English
  if (!selectedVoice && voiceLang === 'en') {
    if (voices[0]?.lang?.startsWith('en')) {
      selectedVoice = voices[0];
    }
    // If voices[0] is NOT English, leave null (OS picks via utterance.lang)
  }

  return selectedVoice;
}

// === TESTS ===

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

console.log('\n=== Test 1: Vietnamese user + English output → must use English voice ===');
{
  const voice = selectVoice(MOCK_VOICES, 'en', 'en', 'vi');
  assert(voice !== null, 'Voice is not null');
  assert(voice?.lang?.startsWith('en'), `Voice lang starts with "en" (got: ${voice?.lang})`);
  assert(!voice?.lang?.startsWith('vi'), `Voice is NOT Vietnamese (got: ${voice?.name})`);
}

console.log('\n=== Test 2: Vietnamese user + Vietnamese output → must use Vietnamese voice ===');
{
  const voice = selectVoice(MOCK_VOICES, 'vi', 'vi', 'vi');
  assert(voice !== null, 'Voice is not null');
  assert(voice?.lang?.startsWith('vi'), `Voice lang starts with "vi" (got: ${voice?.lang})`);
}

console.log('\n=== Test 3: Vietnamese default accent (no explicit choice) → Southern ===');
{
  // getVietnameseVoice with 'southern' accent
  const voice = getVietnameseVoice(MOCK_VOICES, 'southern');
  assert(voice !== null, 'Voice is not null');
  assert(voice?.lang?.startsWith('vi'), `Voice is Vietnamese (got: ${voice?.lang})`);
}

console.log('\n=== Test 4: Interpreter turn: Vi→En → English voice ===');
{
  // Simulates: interpreterTurnRef='from', pair={fromCode:'vi', toCode:'en'}
  // _iSpeakCode = 'en' (listening Vi, speak En)
  const voice = selectVoice(MOCK_VOICES, 'en', 'en', 'vi');
  assert(voice?.lang?.startsWith('en'), `English voice selected for En output (got: ${voice?.name} ${voice?.lang})`);
}

console.log('\n=== Test 5: Interpreter turn: En→Vi → Vietnamese voice ===');
{
  // Simulates: interpreterTurnRef='to', pair={fromCode:'vi', toCode:'en'}
  // _iSpeakCode = 'vi' (listening En, speak Vi)
  const voice = selectVoice(MOCK_VOICES, 'vi', 'vi', 'vi', 'southern');
  assert(voice?.lang?.startsWith('vi'), `Vietnamese voice selected for Vi output (got: ${voice?.name} ${voice?.lang})`);
}

console.log('\n=== Test 6: Profile language must NOT force output voice ===');
{
  // User profile is Vietnamese, but output should be English
  const voice = selectVoice(MOCK_VOICES, 'en', 'en', 'vi');
  assert(!voice?.lang?.startsWith('vi'), `Profile lang (vi) did NOT force Vietnamese voice (got: ${voice?.name} ${voice?.lang})`);
}

console.log('\n=== Test 7: Vietnamese device where voices[0] is Vietnamese ===');
{
  // On Vietnamese devices, voices[0] is often the Vi voice
  const viFirstVoices = [
    { name: 'Linh', lang: 'vi-VN' },  // voices[0] is Vietnamese!
    { name: 'Samantha', lang: 'en-US' },
  ];
  const voice = selectVoice(viFirstVoices, 'en', 'en', 'vi');
  assert(voice?.lang?.startsWith('en'), `Did NOT use Vietnamese voices[0] for English output (got: ${voice?.name} ${voice?.lang})`);
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
