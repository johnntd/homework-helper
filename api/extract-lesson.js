const ALLOWED_ORIGIN = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:5173';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text, subject = '', gradeLevel = '' } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length < 50) {
      return res.status(400).json({ error: 'text must be at least 50 characters' });
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

    const prompt = `You are a curriculum designer extracting structured teaching content from source material for a child AI tutor.

Source material${subject ? ` (${subject}${gradeLevel ? `, grade ${gradeLevel}` : ''})` : ''}:
<source>
${text.slice(0, 6000)}
</source>

Extract the most teachable content from this source. Return ONLY valid JSON with no extra text:
{
  "title": "Short descriptive title for this lesson (5-8 words)",
  "explanation": "2-3 sentence plain-language explanation a child could understand. No jargon.",
  "vocabulary": [
    { "word": "key term", "definition": "one clear sentence", "example": "use it in a sentence" }
  ],
  "questions": [
    { "question": "question to test understanding", "hint": "one-word or short hint", "sampleAnswer": "the ideal short answer" }
  ]
}
Rules:
- vocabulary: 3-6 words maximum, pick only the most important terms
- questions: 4-6 questions maximum, ordered easy to hard
- sampleAnswer: keep to 1-2 sentences, child-friendly language
- All content must come directly from the source — do not add outside facts`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || 'API error' });

    const raw = data?.content?.[0]?.text || '{}';
    const s = raw.indexOf('{');
    const e = raw.lastIndexOf('}');
    const lesson = s !== -1 ? JSON.parse(raw.slice(s, e + 1)) : null;
    if (!lesson?.title) return res.status(500).json({ error: 'Failed to parse lesson' });

    return res.status(200).json(lesson);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
