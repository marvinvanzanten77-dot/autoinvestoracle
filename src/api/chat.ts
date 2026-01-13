import { API_BASE } from './dashboard';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatResponse = {
  reply: string;
  createdAt: string;
};

export async function sendChatMessage(messages: ChatMessage[]): Promise<ChatResponse> {
  const resp = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });
  if (!resp.ok) {
    throw new Error(`API error ${resp.status}`);
  }
  return resp.json();
}
