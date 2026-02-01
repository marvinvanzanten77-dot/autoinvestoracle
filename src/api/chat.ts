import { API_BASE } from './dashboard';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatContext = {
  profile?: {
    displayName?: string;
    strategy?: string;
    primaryGoal?: string;
    timeHorizon?: string;
    knowledgeLevel?: string;
    startAmountRange?: string;
  };
  market?: {
    volatilityLabel?: string;
    volatilityLevel?: string;
    lastScan?: string;
    changes?: {
      bitcoin: number;
      ethereum: number;
      stablecoins: number;
      altcoins: number;
    };
  };
  exchanges?: {
    connected: string[];
    balances?: Array<{
      exchange: string;
      total: number;
    }>;
  };
};

export type ChatResponse = {
  reply: string;
  createdAt: string;
};

export type InsightInput = {
  profile?: {
    displayName?: string;
    strategy?: string;
    primaryGoal?: string;
    timeHorizon?: string;
    knowledgeLevel?: string;
  };
  market?: {
    volatilityLevel?: string;
    volatilityLabel?: string;
    changes?: {
      bitcoin: number;
      ethereum: number;
      stablecoins: number;
      altcoins: number;
    };
  };
  currentAllocation?: Array<{ label: string; pct: number }>;
};

export type InsightResponse = {
  insights: string;
  createdAt: string;
};

export async function sendChatMessage(
  messages: ChatMessage[],
  context?: ChatContext
): Promise<ChatResponse> {
  const resp = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context })
  });
  if (!resp.ok) {
    throw new Error(`API error ${resp.status}`);
  }
  return resp.json();
}

export async function fetchInsights(input: InsightInput): Promise<InsightResponse> {
  const resp = await fetch(`${API_BASE}/api/insights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!resp.ok) {
    throw new Error(`API error ${resp.status}`);
  }
  return resp.json();
}
