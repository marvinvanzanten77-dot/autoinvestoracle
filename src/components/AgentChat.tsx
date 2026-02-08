import { useState, useRef, useEffect } from 'react';

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load user session and restore chat history from localStorage
  useEffect(() => {
    const initSession = async () => {
      try {
        const resp = await fetch('/api/session/init');
        if (resp.ok) {
          const data = (await resp.json()) as { userId: string };
          setUserId(data.userId);

          // Restore chat history from localStorage
          const storageKey = `agent_chat_${data.userId}_${exchange}`;
          const storedMessages = localStorage.getItem(storageKey);
          if (storedMessages) {
            try {
              setMessages(JSON.parse(storedMessages));
              return; // Don't fetch initial analysis if we have stored messages
            } catch (e) {
              console.warn('Could not restore agent chat history:', e);
            }
          }
        }
      } catch (err) {
        console.error('Error initializing session:', err);
      }
    };

    if (isOpen) {
      initSession().then(() => {
        // Fetch initial analysis only if no stored messages
        if (messages.length === 0) {
          fetchInitialAnalysis();
        }
      });
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
    if (!input.trim()) return;

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
      // SAFETY: Only suggest config changes, never market actions
      let agentResponse = '';
      const lowerInput = input.toLowerCase();

      // CONFIG_CHAT mode: Parse user intent for parameter suggestions only
      if (
        lowerInput.includes('risico') ||
        lowerInput.includes('risk') ||
        lowerInput.includes('aggressief') ||
        lowerInput.includes('voorzichtig')
      ) {
        agentResponse =
          'Je risico-instelling aanpassen: Volgens je huidige instellingen riskeer je momenteel X% per trade. ' +
          'Je kunt dit verhogen naar 5% voor meer agressief, of verlagen naar 1% voor voorzichtiger. ' +
          'Welke percentage voorkeur heb je?';
      } else if (
        lowerInput.includes('interval') ||
        lowerInput.includes('check') ||
        lowerInput.includes('frequentie')
      ) {
        agentResponse =
          'Je check-interval aanpassen: Momenteel check ik je portfolio elke X minuten. ' +
          'Je kunt dit aanpassen naar 5, 15, 30 minuten of elk uur. ' +
          'Welke interval past beter voor jou?';
      } else if (
        lowerInput.includes('trading') ||
        lowerInput.includes('auto') ||
        lowerInput.includes('handel')
      ) {
        agentResponse =
          'Auto-trading mode: Momenteel sta je in monitoring-mode (read-only). ' +
          'Je kunt dit wijzigen naar trading-mode, waarna ik automatisch zal handelen volgens je regels. ' +
          'Let op: Dit is een keuze voor je instellingen, niet iets wat ik zal doen.';
      } else if (
        lowerInput.includes('strategie') ||
        lowerInput.includes('strategy') ||
        lowerInput.includes('conservatief') ||
        lowerInput.includes('agressief')
      ) {
        agentResponse =
          'Je handelsstrategie: Momenteel volg je de X strategie. ' +
          'Je kunt dit wijzigen in conservative (voorzichtig), balanced (gemiddeld), of aggressive (risicovol). ' +
          'Deze wijziging bepaalt hoe ik je portfolio bewaak.';
      } else if (lowerInput.includes('status') || lowerInput.includes('wat')) {
        agentResponse =
          'Je portfolio staat goed. Alle systemen werken normaal. ' +
          'Volgens je huidige instellingen: monitoring-mode, momenteel geen auto-trading. ' +
          'Wat zou je willen aanpassen aan je instellingen?';
      } else if (
        lowerInput.includes('stop') ||
        lowerInput.includes('loss') ||
        lowerInput.includes('veiligheid')
      ) {
        agentResponse =
          'Je veiligheidsmaatregelen: Je hebt dagelijkse verlieslimieten ingesteld, ' +
          'en je kunt stop-loss aanschakelen om automatisch te stoppen bij bepaalde verliezen. ' +
          'Welke veiligheidsmaatregel wil je aanpassen?';
      } else {
        agentResponse =
          'Ik kan je helpen met instellingen aanpassen: risico-level, check-interval, ' +
          'strategie keuze, of veiligheidsmaatregelen. ' +
          'Wat zou je willen veranderen aan je agent-instellingen?';
      }

      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate delay

      const agentMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: agentResponse,
        timestamp: new Date().toISOString()
      };

      setMessages((prev) => [...prev, agentMessage]);
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setLoading(false);
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
