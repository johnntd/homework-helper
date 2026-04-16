// Gemini TTS proxy — Sunny AI Coach voice synthesis
// Matches the Salon AI Agent voice strategy: Sulafat (EN) / Aoede (VI, ES, others)
// Returns raw Int16 PCM at 24 kHz, base64-encoded, for Web Audio API playback in the client.
const ALLOWED_ORIGIN = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:5173';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, lang = 'en' } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // Graceful degradation — caller falls back to browser SpeechSynthesis
    return res.status(503).json({ error: 'TTS unavailable' });
  }
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text required' });
  }

  // Voice selection per language:
  //   Sulafat — warm English (EN)
  //   Aoede   — breezy multilingual (VI, ES)
  //   Kore    — natural Korean (KO)
  //   Kore    — also used for Japanese (JA) as closest available
  // OpenAI nova (the tier above) handles JA/KO better; this is the Gemini fallback.
  const VOICE_MAP = { en: 'Sulafat', vi: 'Aoede', es: 'Aoede', ko: 'Kore', ja: 'Kore' };
  const voiceName = VOICE_MAP[lang] || 'Aoede';

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    'gemini-2.5-flash-preview-tts:generateContent?key=' +
    encodeURIComponent(apiKey);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: text.slice(0, 2000) }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[/api/tts] Gemini ${response.status}:`, errText.slice(0, 200));
      return res.status(502).json({ error: `Gemini TTS ${response.status}` });
    }

    const data = await response.json();
    const part = data.candidates?.[0]?.content?.parts?.[0];

    if (!part?.inlineData?.data) {
      return res.status(502).json({ error: 'No audio data in Gemini response' });
    }

    // Return raw PCM data — client decodes Int16 → Float32 via Web Audio API
    res.json({
      audio: part.inlineData.data,
      mimeType: part.inlineData.mimeType || 'audio/L16;rate=24000',
      voice: voiceName,
      lang,
    });
  } catch (err) {
    console.error('[/api/tts]', err.message);
    res.status(500).json({ error: err.message });
  }
}
