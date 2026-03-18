// Simple local server to handle API requests during development
// Run this with: node server.js (in a separate terminal)
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.post('/api/chat', async (req, res) => {
  try {
    const { system, messages, maxTokens } = req.body;

    // Log what we received from frontend
    console.log('\n=== REQUEST FROM FRONTEND ===');
    console.log('System prompt length:', system?.length || 0);
    console.log('Number of messages:', messages?.length || 0);
    console.log('Messages:', JSON.stringify(messages, null, 2));
    
    // Validate messages format
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error('Invalid messages format');
      return res.status(400).json({ error: 'Messages must be a non-empty array' });
    }
    
    // Check each message
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      console.log(`Message ${i}: role="${msg.role}", content type=${typeof msg.content}`);
      
      if (!msg.role || !msg.content) {
        console.error(`Invalid message ${i}:`, msg);
        return res.status(400).json({ error: `Message ${i} is invalid` });
      }
    }
    
    // Create request for Anthropic
    const requestBody = {
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens || 8000,
      system: system,
      messages: messages
    };
    
    console.log('\n=== SENDING TO ANTHROPIC ===');
    console.log(JSON.stringify(requestBody, null, 2));
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('\n=== ANTHROPIC API ERROR ===');
      console.error('Status:', response.status);
      console.error('Response:', JSON.stringify(data, null, 2));
      return res.status(response.status).json(data);
    }

    console.log('\n=== SUCCESS ===\n');
    res.json(data);
  } catch (error) {
    console.error('\n=== SERVER ERROR ===');
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Web search endpoint for Interview Prep — uses Brave Search API
// Add BRAVE_SEARCH_API_KEY to .env (free tier: 2000 queries/month at search.brave.com/app)
app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) {
      console.log('No BRAVE_SEARCH_API_KEY set — returning empty results');
      return res.json({ results: [] });
    }
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&text_decorations=false`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey }
    });
    const data = await response.json();
    const results = (data.web?.results || []).slice(0, 5).map(r => ({
      title: r.title,
      description: r.description,
      url: r.url,
    }));
    console.log(`Search "${query}" → ${results.length} results`);
    res.json({ results });
  } catch (err) {
    console.error('Search error:', err.message);
    res.json({ results: [] }); // graceful degradation
  }
});

// Stock market data endpoint — proxies Yahoo Finance (free, no API key needed)
app.get('/api/stock', async (req, res) => {
  const { symbol = 'AAPL', interval = '1d', range = '3mo' } = req.query;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    });
    if (!response.ok) return res.json({ candles: [] });
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    if (!result) return res.json({ candles: [] });
    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const candles = timestamps.map((t, i) => ({
      time: t, open: quote.open?.[i], high: quote.high?.[i],
      low: quote.low?.[i], close: quote.close?.[i], volume: quote.volume?.[i] || 0,
    })).filter(c => c.open != null && c.high != null && c.low != null && c.close != null);
    console.log(`Stock ${symbol}: ${candles.length} candles`);
    res.json({ symbol, candles });
  } catch (err) {
    console.error('Stock error:', err.message);
    res.json({ candles: [] });
  }
});

// Prediction market data — proxies Polymarket Gamma API (public, no auth needed)
app.get('/api/polymarket', async (req, res) => {
  const GAMMA_URL = 'https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume&ascending=false&limit=50';
  try {
    const response = await fetch(GAMMA_URL, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    if (!response.ok) throw new Error(`Gamma API ${response.status}`);
    const raw = await response.json();
    const markets = (Array.isArray(raw) ? raw : raw.markets || [])
      .filter(m =>
        parseFloat(m.volume || 0) > 5000 &&
        parseFloat(m.liquidity || 0) > 1000 &&
        m.endDate && (new Date(m.endDate) - Date.now()) < 30 * 24 * 60 * 60 * 1000
      )
      .slice(0, 10)
      .map(m => ({
        id:        m.id || m.conditionId || '',
        question:  m.question || '',
        yes_bid:   parseFloat(m.bestBid  || m.yes_bid  || 0),
        yes_ask:   parseFloat(m.bestAsk  || m.yes_ask  || 0),
        no_bid:    parseFloat(m.no_bid   || 0),
        volume:    parseFloat(m.volume   || 0),
        liquidity: parseFloat(m.liquidity || 0),
        endDate:   m.endDate || '',
        outcomes:  m.outcomes || ['Yes', 'No'],
      }));
    console.log(`Polymarket: ${markets.length} markets returned (live)`);
    res.json({ markets, source: 'live' });
  } catch (err) {
    console.error('Polymarket error:', err.message, '— using mock data');
    res.json({
      source: 'mock',
      markets: [
        { id: 'mock-1', question: 'Will the Fed cut rates before June 2025?', yes_bid: 0.62, yes_ask: 0.64, no_bid: 0.36, volume: 182000, liquidity: 45000, endDate: new Date(Date.now() + 18 * 86400000).toISOString(), outcomes: ['Yes', 'No'] },
        { id: 'mock-2', question: 'Will BTC exceed $100k by end of Q2 2025?', yes_bid: 0.41, yes_ask: 0.43, no_bid: 0.57, volume: 97000, liquidity: 28000, endDate: new Date(Date.now() + 25 * 86400000).toISOString(), outcomes: ['Yes', 'No'] },
        { id: 'mock-3', question: 'Will the S&P 500 close above 5800 this week?', yes_bid: 0.55, yes_ask: 0.57, no_bid: 0.43, volume: 54000, liquidity: 12000, endDate: new Date(Date.now() + 5 * 86400000).toISOString(), outcomes: ['Yes', 'No'] },
        { id: 'mock-4', question: 'Will NVDA stock close above $900 this month?', yes_bid: 0.48, yes_ask: 0.50, no_bid: 0.50, volume: 67000, liquidity: 18000, endDate: new Date(Date.now() + 12 * 86400000).toISOString(), outcomes: ['Yes', 'No'] },
        { id: 'mock-5', question: 'Will ETH exceed $4000 before April 2025?', yes_bid: 0.33, yes_ask: 0.35, no_bid: 0.65, volume: 45000, liquidity: 11000, endDate: new Date(Date.now() + 20 * 86400000).toISOString(), outcomes: ['Yes', 'No'] },
      ]
    });
  }
});

// Gemini API proxy — supporting content generation (stories, grammar feedback, math hints)
app.post('/api/gemini', async (req, res) => {
  const { task, context } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.json({ result: null, source: 'unavailable' });

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const prompts = {
    generate_story: ({ topic, ageGroup, level, subject }) => {
      const wordCount = ageGroup === '4-6' ? '60-80' : ageGroup === '7-9' ? '100-130' : '150-200';
      return `Write a SHORT engaging reading story (${wordCount} words) for a ${ageGroup}-year-old about "${topic}" related to ${subject}. Requirements: age-appropriate vocabulary, simple clear sentences, one clear main idea, engaging warm tone, end with ONE comprehension question. Return ONLY valid JSON: {"title":"Story title (max 6 words)","passage":"The full story text...","question":"One comprehension question","answer_hint":"Key words for a correct answer"}`;
    },
    explain_concept: ({ concept, ageGroup, subject }) =>
      `Explain "${concept}" to a ${ageGroup}-year-old studying ${subject}. Use simple analogies, max 3 sentences, concrete visual language, end with a "try this" hook. Return ONLY valid JSON: {"explanation":"...","analogy":"...","hook":"..."}`,
    grammar_feedback: ({ text, ageGroup }) =>
      `A ${ageGroup}-year-old wrote: "${text}". Analyze grammar, give encouraging feedback. Return ONLY valid JSON: {"corrected":"...","errors":["..."],"rule":"Main grammar rule to teach (one sentence)","praise":"One specific thing they did well","encouragement":"Warm brief encouragement (max 15 words)"}`,
    math_hint: ({ problem, attempt, ageGroup }) =>
      `A ${ageGroup}-year-old is solving: "${problem}". Their attempt: "${attempt}". Give a Socratic hint WITHOUT revealing the answer. Return ONLY valid JSON: {"hint":"Hint that guides without revealing (max 25 words)","visual_suggestion":"Brief description of a helpful visual","next_step":"The very next small step to think about"}`,
    pronunciation_guide: ({ word, language }) =>
      `Break down the pronunciation of "${word}" in ${language} for a language learner. Return ONLY valid JSON: {"syllables":["syl","la","bles"],"phonetic":"Simple phonetic spelling","tip":"One pronunciation tip (max 15 words)","sounds_like":"English word it sounds similar to (if applicable)"}`,
    word_problem: ({ topic, operation, level, ageGroup }) =>
      `Create a fun math word problem for a ${ageGroup}-year-old. Topic: ${topic}, Operation: ${operation}, Difficulty: ${level}. Return ONLY valid JSON: {"problem":"Word problem (max 40 words, real-world scenario kids love)","answer":"The numeric answer","hint":"A gentle hint that doesn't give away the answer"}`,
    chemistry_problem: ({ topic, level, ageGroup }) =>
      `Generate a chemistry practice problem for a ${ageGroup}-year-old at ${level} difficulty. Topic: ${topic}. Return ONLY valid JSON: {"problem":"Problem statement with all given values","equation":"Key chemical equation","steps":["Step 1","Step 2","Step 3"],"answer":"Final answer with units","hint":"Hint without revealing answer"}`,
    physics_problem: ({ topic, level, ageGroup }) =>
      `Generate a physics practice problem for a ${ageGroup}-year-old at ${level} difficulty. Topic: ${topic}. Return ONLY valid JSON: {"problem":"Problem with all given quantities and units","formula":"Primary formula (e.g. F = ma)","variables":{"F":"Force (N)"},"steps":["Step 1","Step 2","Step 3","Step 4"],"answer":"Numeric answer with units","hint":"Conceptual hint"}`,
    coding_exercise: ({ language, topic, level, ageGroup }) =>
      `Generate a coding exercise in ${language} for a ${ageGroup}-year-old at ${level} difficulty. Topic: ${topic}. Return ONLY valid JSON: {"title":"Short title","instructions":"What the student must write or fix","starter_code":"Starter code with blanks or bug","solution_code":"Complete correct solution","hint":"One useful hint","expected_output":"What running the solution should produce"}`,
  };

  const promptFn = prompts[task];
  if (!promptFn) return res.status(400).json({ error: `Unknown task: ${task}` });

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFn(context || {}) }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
      }),
    });
    if (!response.ok) throw new Error(`Gemini API ${response.status}`);
    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let result = {};
    try {
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s !== -1 && e !== -1) result = JSON.parse(raw.slice(s, e + 1));
    } catch { result = { raw }; }
    res.setHeader('Cache-Control', 's-maxage=0');
    return res.json({ result, source: 'gemini' });
  } catch (err) {
    return res.json({ result: null, source: 'error', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ API server running on http://localhost:${PORT}`);
  console.log(`📡 Ready to handle requests from http://localhost:5173`);
  console.log(`\n🔑 Make sure your .env file has ANTHROPIC_API_KEY set!\n`);
});
