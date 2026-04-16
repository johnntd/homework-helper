// OpenAI TTS proxy — nova voice (warm female, multilingual).
// Streams binary MP3 directly from OpenAI to the client — no base64 buffering.
// Client uses MediaSource (desktop) or arrayBuffer fallback (iOS) for fast playback.
const ALLOWED_ORIGIN = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:5173';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body || {};
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) return res.status(503).json({ error: 'OpenAI TTS unavailable' });
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text required' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text.slice(0, 4096),
        voice: 'nova',
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[/api/tts-openai] OpenAI ${response.status}:`, errText.slice(0, 200));
      return res.status(502).json({ error: `OpenAI TTS ${response.status}` });
    }

    // Stream binary MP3 directly — pipe each chunk to the client as it arrives
    res.setHeader('Content-Type', 'audio/mpeg');
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    console.error('[/api/tts-openai]', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
}
