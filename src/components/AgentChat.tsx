import { useState, useRef, useEffect } from 'react';
import type { UnifiedContext } from '../lib/unifiedContextService';
import { buildUnifiedContextWithCache } from '../lib/unifiedContextService';
import { parseSettingsIntent, executeSettingsUpdate, describeSettingChange } from '../lib/chatSettingsManager';
import { triggerMarketScan } from '../lib/marketScanScheduler';

type ChatMessage = {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
};

interface AgentChatProps {
  exchange: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AgentChat({ exchange, isOpen, onClose }: AgentChatProps) {
  const [userId, setUserId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string>('');
  const [unifiedContext, setUnifiedContext] = useState<UnifiedContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load user session and build unified context
  useEffect(() => {
    const initSession = async () => {
      try {
        const resp = await fetch('/api/session/init');
        if (resp.ok) {
          const data = (await resp.json()) as { userId: string; sessionId?: string };
          setUserId(data.userId);
          const sid = data.sessionId || `session_${Date.now()}`;
          setSessionId(sid);

          // Build unified context for this user
          const context = await buildUnifiedContextWithCache(data.userId, sid);
          setUnifiedContext(context);

          // Restore chat history from localStorage
          const storageKey = `agent_chat_${data.userId}_${exchange}`;
          const storedMessages = localStorage.getItem(storageKey);
          if (storedMessages) {
            try {
              setMessages(JSON.parse(storedMessages));
              return;
            } catch (e) {
              console.warn('Could not restore agent chat history:', e);
            }
          }

          // Fetch initial analysis
          await fetchInitialAnalysis();
        }
      } catch (err) {
        console.error('Error initializing session:', err);
      }
    };

    if (isOpen) {
      initSession();
    }
  }, [isOpen]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (userId && messages.length > 0) {
      const storageKey = `agent_chat_${userId}_${exchange}`;
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [messages, userId, exchange]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchInitialAnalysis = async () => {
    try {
      const resp = await fetch('/api/agent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange, mode: 'config_chat' })
      });
      if (resp.ok) {
        const data = (await resp.json()) as { analysis: string };
        setAnalysis(data.analysis);
        setMessages([
          {
            id: '0',
            role: 'agent',
            content: data.analysis,
            timestamp: new Date().toISOString()
          }
        ]);
      }
    } catch (err) {
      console.error('Error fetching initial analysis:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !userId || !unifiedContext) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const lowerInput = input.toLowerCase();

      // ===== HANDLE MARKET SCAN REQUEST =====
      if (lowerInput.includes('scan') || lowerInput.includes('kijk') || lowerInput.includes('check')) {
        const scanResult = await triggerMarketScan(userId, exchange);
        const agentResponse = scanResult
          ? `✅ Marktcan complete!\nVolatiliteit: ${scanResult.findings.volatility}/100\nSentiment: ${scanResult.findings.sentiment}/100\n${scanResult.findings.observations.join('\n')}`
          : '❌ Marktscan mislukt. Probeer later opnieuw.';
        
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'agent',
            content: agentResponse,
            timestamp: new Date().toISOString()
          }
        ]);
        setLoading(false);
        return;
      }

      // ===== HANDLE SETTINGS CHANGES =====
      const settingsUpdate = parseSettingsIntent(input, unifiedContext);
      if (settingsUpdate) {
        const description = describeSettingChange(settingsUpdate);
        
        // Confirm if needed
        if (settingsUpdate.confirmationRequired) {
          const confirmMessage = `Wil je dit echt veranderen?\n${description}\n\nReply met "ja" om te bevestigen.`;
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: 'agent',
              content: confirmMessage,
              timestamp: new Date().toISOString()
            }
          ]);
          setLoading(false);
          return;
        }

        // Execute the update
        const result = await executeSettingsUpdate(userId, settingsUpdate);
        const responseMsg = result.success
          ? `✅ ${result.message}`
          : `❌ Kon niet bijwerken: ${result.message}`;

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'agent',
            content: responseMsg,
            timestamp: new Date().toISOString()
          }
        ]);
        setLoading(false);
        return;
      }

      // ===== DEFAULT: USE OPENAI CHAT WITH UNIFIED CONTEXT =====
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content
          })),
          context: {
            profile: unifiedContext.profile,
            market: unifiedContext.market,
            exchanges: unifiedContext.exchanges,
            trading: unifiedContext.trading,
            dataSources: unifiedContext.dataSources
          }
        })
      });

      if (resp.ok) {
        const data = (await resp.json()) as { reply: string };
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'agent',
            content: data.reply,
            timestamp: new Date().toISOString()
          }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'agent',
            content: '❌ Fout bij ophalen van antwoord.',
            timestamp: new Date().toISOString()
          }
        ]);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          content: '❌ Er is een fout opgetreden.',
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshContext = async () => {
    if (!userId) return;
    try {
      const context = await buildUnifiedContextWithCache(userId, sessionId);
      setUnifiedContext(context);
    } catch (err) {
      console.error('Error refreshing context:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-center bg-black/20">
      <div className="w-full sm:w-96 h-screen sm:h-[600px] bg-white rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div>
            <p className="font-semibold text-slate-900">Agent Copilot</p>
            <p className="text-xs text-slate-600">{exchange}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-primary/20 text-primary rounded-br-none'
                    : 'bg-slate-100 text-slate-900 rounded-bl-none'
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.content}</p>
                <p className="text-xs mt-1 opacity-60">
                  {new Date(msg.timestamp).toLocaleTimeString('nl-NL', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 text-slate-900 rounded-lg p-3 rounded-bl-none">
                <p className="text-sm">Agent denkt na...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Vraag of wijziging..."
              disabled={loading}
              className="flex-1 text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={loading || !input.trim()}
              className="px-3 py-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ↑
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            💡 Vraag me over risico, interval, strategie, of veiligheid
          </p>
        </div>
      </div>
    </div>
  );
}
