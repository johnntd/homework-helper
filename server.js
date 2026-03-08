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
    const { system, messages } = req.body;
    
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
      max_tokens: 4000,
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

app.listen(PORT, () => {
  console.log(`✅ API server running on http://localhost:${PORT}`);
  console.log(`📡 Ready to handle requests from http://localhost:5173`);
  console.log(`\n🔑 Make sure your .env file has ANTHROPIC_API_KEY set!\n`);
});
