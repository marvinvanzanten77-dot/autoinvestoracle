import type { ApiRequest, ApiResponse } from './types';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ChatRequest = {
  messages: ChatMessage[];
};

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function generateChatReply(messages: ChatMessage[]) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY ontbreekt.');
  }

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            'Je bent een rustige crypto-assistent. Je geeft geen advies of besluiten, alleen uitleg en opties in mensentaal.'
        },
        ...messages
      ]
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as OpenAIChatResponse;
  return data.choices?.[0]?.message?.content?.trim() || 'Geen antwoord beschikbaar.';
}

export async function handleChat(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { messages } = (req.body || {}) as ChatRequest;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages is verplicht.' });
      return;
    }
    const reply = await generateChatReply(messages);
    res.status(200).json({ reply, createdAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kon chat niet ophalen.' });
  }
}
