const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ PUT YOUR API KEY HERE
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'YOUR_API_KEY_HERE';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));
   
   app.get('/', (req, res) => {
     res.sendFile(__dirname + '/index.html');
   });

// Analyze image endpoint
app.post('/api/analyze-image', async (req, res) => {
  try {
    const { image } = req.body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20241022',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: image
              }
            },
            {
              type: 'text',
              text: 'You are helping an elderly person understand this document. Analyze it and provide:\n\n1. What type of document this is (in very simple terms)\n2. The key information they need to know\n3. What action (if any) they need to take\n4. Whether it appears safe/legitimate\n\nUse very simple, clear language. Be warm and reassuring. Keep your response concise - use short paragraphs with line breaks between key points.'
            }
          ]
        }]
      })
    });

    const data = await response.json();
   console.log('Full API response:', JSON.stringify(data, null, 2));
const aiResponse = data.content?.find(item => item.type === 'text')?.text || 'I had trouble reading this document.';
     
    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to analyze image' });
  }
});

// Check message endpoint
app.post('/api/check-message', async (req, res) => {
  try {
    const { message } = req.body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20241022',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `You are helping an elderly person determine if this message is a scam or safe. 

Analyze this message and provide:
1. A clear risk assessment: SAFE, SUSPICIOUS, or SCAM
2. A simple explanation why (2-3 sentences)
3. What they should do

Be very direct and clear. Use simple language.

Message to analyze:
"${message}"`
        }]
      })
    });

    const data = await response.json();
    const aiResponse = data.content?.find(item => item.type === 'text')?.text || '';

    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to check message' });
  }
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20241022',
        max_tokens: 1000,
        messages: messages,
        system: 'You are a patient, kind AI assistant helping elderly people with technology and daily tasks. Use very simple language, be warm and reassuring, and avoid jargon. Keep responses concise and actionable (2-4 short sentences). If they seem confused, offer to help them call a family member or guide them step by step. Never use technical terms without explaining them simply.'
      })
    });

    const data = await response.json();
    const aiResponse = data.content?.find(item => item.type === 'text')?.text || 'I\'m here to help. Can you tell me more?';

    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to get response' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
