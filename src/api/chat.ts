import { API_BASE } from './dashboard';

// Logger utility - toon alles in console
const logger = {
  context: (label: string, data: any) => {
    console.group(`🔍 Context: ${label}`);
    console.log(data);
    console.groupEnd();
  },
  request: (label: string, data: any) => {
    console.group(`📤 Request: ${label}`);
    console.log(data);
    console.groupEnd();
  },
  response: (label: string, data: any) => {
    console.group(`📥 Response: ${label}`);
    console.log(data);
    console.groupEnd();
  },
  error: (label: string, error: any) => {
    console.group(`❌ Error: ${label}`, { color: 'red' });
    console.error(error);
    console.groupEnd();
  }
};

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
  logger.context('Chat', { messages, context });
  const resp = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context })
  });
  if (!resp.ok) {
    logger.error('sendChatMessage', `API error ${resp.status}`);
    throw new Error(`API error ${resp.status}`);
  }
  const data = await resp.json();
  logger.response('Chat Reply', data);
  return data;
}

export async function fetchInsights(input: InsightInput): Promise<InsightResponse> {
  logger.context('Insights Input', input);
  const resp = await fetch(`${API_BASE}/api/insights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!resp.ok) {
    logger.error('fetchInsights', `API error ${resp.status}`);
    throw new Error(`API error ${resp.status}`);
  }
  const data = await resp.json();
  logger.response('Insights', data);
  return data;
}
