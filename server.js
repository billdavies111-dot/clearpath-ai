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

// Get emails from Gmail
app.post('/api/get-emails', async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: 'Get my 10 most recent emails from Gmail. For each email, I need: sender name/email, subject, a short snippet (first 100 characters of body), the date, and the email ID. Return the results as a JSON array.'
        }],
        mcp_servers: [
          {
            type: 'url',
            url: 'https://gmailmcp.googleapis.com/mcp/v1',
            name: 'gmail-mcp'
          }
        ]
      })
    });

    const data = await response.json();
    console.log('Gmail MCP Response:', JSON.stringify(data, null, 2));

    let emails = [];
    const textContent = data.content?.find(item => item.type === 'text')?.text || '';
    
    try {
      const jsonMatch = textContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        emails = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse emails:', e);
    }

    if (emails.length === 0) {
      const toolResults = data.content?.filter(item => item.type === 'mcp_tool_result') || [];
      toolResults.forEach(result => {
        try {
          const resultText = result.content?.[0]?.text || '';
          const parsed = JSON.parse(resultText);
          if (Array.isArray(parsed)) {
            emails = parsed;
          }
        } catch (e) {
          console.error('Failed to parse tool result:', e);
        }
      });
    }

    res.json({ emails });
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ error: 'Failed to fetch emails. Make sure Gmail is connected.' });
  }
});

// Analyze email for scams
app.post('/api/analyze-email', async (req, res) => {
  try {
    const { emailId, from, subject, snippet, body } = req.body;
    
    let fullEmailBody = body;
    
    if (!fullEmailBody && emailId) {
      const emailResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `Get the full content of email with ID: ${emailId}`
          }],
          mcp_servers: [
            {
              type: 'url',
              url: 'https://gmailmcp.googleapis.com/mcp/v1',
              name: 'gmail-mcp'
            }
          ]
        })
      });
      
      const emailData = await emailResponse.json();
      fullEmailBody = emailData.content?.find(item => item.type === 'text')?.text || snippet;
    }

    const emailContent = fullEmailBody || snippet || 'No content available';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `You are helping an elderly person check if an email is a scam or legitimate. Analyze this email very carefully for scam indicators.

EMAIL FROM: ${from || 'Unknown'}
SUBJECT: ${subject || 'No subject'}
CONTENT: ${emailContent}

Return your response in this EXACT format:

SUMMARY: [2-3 sentences: what the email is about, who it claims to be from, what they're asking for]

SCAM_SCORE: [EXACTLY one of: "PROBABLY NOT" or "MAYBE" or "PROBABLY"]

RED_FLAGS: [List specific warning signs like: urgent language, requests for money/passwords, spelling errors, suspicious sender address, fake company claims, threats, too-good-to-be-true offers. If none, say "No major red flags detected"]

SAFE_ACTION: [Clear instruction: "Delete this email immediately" OR "This looks legitimate" OR "Ask a family member to verify" OR "Do not click any links"]

IF_CLICKED: [What could happen if they click links or respond? Be specific but not scary]

Be VERY cautious - elderly people are frequent targets. Look for: 
- Urgency/pressure tactics
- Requests for personal info, passwords, or money
- Mismatched sender addresses
- Poor grammar/spelling
- Threats or scare tactics
- Too-good-to-be-true offers
- Impersonation of banks, government, tech support`
        }]
      })
    });

    const data = await response.json();
    const aiResponse = data.content?.find(item => item.type === 'text')?.text || 'I had trouble analyzing this email.';

    const lines = aiResponse.split('\n').filter(line => line.trim());
    let summary = '';
    let scamScore = 'PROBABLY NOT';
    let redFlags = 'No major red flags detected';
    let safeAction = 'Review this email carefully';
    let ifClicked = 'Be cautious with any links';

    lines.forEach(line => {
      if (line.startsWith('SUMMARY:')) {
        summary = line.replace('SUMMARY:', '').trim();
      } else if (line.startsWith('SCAM_SCORE:')) {
        scamScore = line.replace('SCAM_SCORE:', '').trim();
      } else if (line.startsWith('RED_FLAGS:')) {
        redFlags = line.replace('RED_FLAGS:', '').trim();
      } else if (line.startsWith('SAFE_ACTION:')) {
        safeAction = line.replace('SAFE_ACTION:', '').trim();
      } else if (line.startsWith('IF_CLICKED:')) {
        ifClicked = line.replace('IF_CLICKED:', '').trim();
      }
    });

    res.json({ 
      summary,
      scamScore,
      redFlags,
      safeAction,
      ifClicked
    });
  } catch (error) {
    console.error('Error analyzing email:', error);
    res.status(500).json({ error: 'Failed to analyze email' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
