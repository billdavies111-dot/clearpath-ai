const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

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
    const { image, detailed } = req.body;
    
    // Detect image type from base64 header
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

    // Different prompts for basic vs detailed
    const prompt = detailed 
      ? 'You are helping an elderly person understand this document in detail. Provide a comprehensive explanation (300-500 words) that includes:\n\n1. What type of document this is and its purpose\n2. All key information, numbers, dates, and details present\n3. What actions they need to take (if any) with specific deadlines\n4. Any important terms or conditions explained in simple language\n5. Whether there are any concerns or red flags\n6. Whether it appears legitimate and safe\n7. Additional context that would be helpful\n\nUse very simple, clear language. Be thorough but conversational. Break down complex terms. Organize your response in clear paragraphs.'
      : `You are helping an elderly person understand this document. Analyze it for scam risk and provide a structured response.

Return your response in this EXACT format:

SUMMARY: [2-3 sentences: what it is, key number, when/urgency]

SCAM_SCORE: [EXACTLY one of: "PROBABLY NOT" or "MAYBE" or "PROBABLY"]

NEED_ACTION: [EXACTLY one of: "Yes" or "No" or "Soon"]

IF_IGNORED: [1-2 sentences about what happens if they don't respond]

Be direct. Use simple words.`;

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
      // Parse the structured response
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
        model: 'claude-sonnet-4-5',
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
    const { messages, userName } = req.body;
    
    // Add system message with user's name
    const systemMessage = userName 
      ? `You are ClearPath AI, a helpful assistant for elderly users. The user's name is ${userName}. Address them by name when appropriate. Be warm, patient, and use simple language.`
      : 'You are ClearPath AI, a helpful assistant for elderly users. Be warm, patient, and use simple language.';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        system: systemMessage,
        messages: messages
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
