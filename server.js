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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
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

app.listen(PORT, () => {
  console.log(`✅ API server running on http://localhost:${PORT}`);
  console.log(`📡 Ready to handle requests from http://localhost:5173`);
  console.log(`\n🔑 Make sure your .env file has ANTHROPIC_API_KEY set!\n`);
});
