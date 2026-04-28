const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Your Anthropic API key
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'your-api-key-here';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, userName } = req.body;
    
    const systemMessage = userName 
      ? `You are a helpful, friendly AI assistant for an elderly person named ${userName}. Keep responses clear, simple, and warm. Use their name occasionally to be personable.`
      : 'You are a helpful, friendly AI assistant for an elderly person. Keep responses clear, simple, and warm.';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: systemMessage,
        messages: messages
      })
    });

    const data = await response.json();
    const aiResponse = data.content?.find(item => item.type === 'text')?.text || 'I\'m here to help!';

    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).json({ error: 'Failed to get response' });
  }
});

// Image analysis endpoint
app.post('/api/analyze-image', async (req, res) => {
  try {
    const { image, detailed } = req.body;
    
    let mediaType = 'image/jpeg';
    if (image.startsWith('iVBORw0KGgo')) {
      mediaType = 'image/png';
    } else if (image.startsWith('/9j/')) {
      mediaType = 'image/jpeg';
    } else if (image.startsWith('R0lGOD')) {
      mediaType = 'image/gif';
    } else if (image.startsWith('UklGR')) {
      mediaType = 'image/webp';
    }

    const prompt = detailed 
      ? 'You are helping an elderly person understand this document in detail. Provide a comprehensive explanation (300-500 words) that includes:\n\n1. What type of document this is and its purpose\n2. All key information, numbers, dates, and details present\n3. What actions they need to take (if any) with specific deadlines\n4. Any important terms or conditions explained in simple language\n5. Whether there are any concerns or red flags\n6. Whether it appears legitimate and safe\n7. Additional context that would be helpful\n\nUse very simple, clear language. Be thorough but conversational. Break down complex terms. Organize your response in clear paragraphs.'
      : `You are helping an elderly person understand this document or email. Analyze it for scam risk and provide a structured response.

Return your response in this EXACT format:

SUMMARY: [2-3 sentences: what it is, key number/details, when/urgency]

SCAM_SCORE: [EXACTLY one of: "PROBABLY NOT" or "MAYBE" or "PROBABLY"]

NEED_ACTION: [EXACTLY one of: "Yes" or "No" or "Soon"]

IF_IGNORED: [1-2 sentences about what happens if they don't respond]

Be direct. Use simple words. If this is an email, look extra carefully for phishing, urgent requests for money/passwords, fake sender addresses, and too-good-to-be-true offers.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: detailed ? 2000 : 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: image
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }]
      })
    });

    const data = await response.json();
    console.log('Full API response:', JSON.stringify(data, null, 2));
    const aiResponse = data.content?.find(item => item.type === 'text')?.text || 'I had trouble reading this document.';

    if (detailed) {
      res.json({ response: aiResponse });
    } else {
      const lines = aiResponse.split('\n').filter(line => line.trim());
      let summary = '';
      let scamScore = 'PROBABLY NOT';
      let needAction = 'No';
      let ifIgnored = 'Nothing urgent will happen.';

      lines.forEach(line => {
        if (line.startsWith('SUMMARY:')) {
          summary = line.replace('SUMMARY:', '').trim();
        } else if (line.startsWith('SCAM_SCORE:')) {
          scamScore = line.replace('SCAM_SCORE:', '').trim();
        } else if (line.startsWith('NEED_ACTION:')) {
          needAction = line.replace('NEED_ACTION:', '').trim();
        } else if (line.startsWith('IF_IGNORED:')) {
          ifIgnored = line.replace('IF_IGNORED:', '').trim();
        }
      });

      res.json({ 
        summary,
        scamScore,
        needAction,
        ifIgnored
      });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to analyze image' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
