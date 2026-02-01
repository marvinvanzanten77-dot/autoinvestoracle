import { useState } from 'react';
import { sendChatMessage, type ChatMessage, type ChatContext } from '../api/chat';
import { academyCurriculum, type AcademyModule } from '../data/academyCurriculum';

interface AiTutorModalProps {
  isOpen: boolean;
  module: AcademyModule;
  onClose: () => void;
}

export function AiTutorModal({ isOpen, module, onClose }: AiTutorModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hallo! 👋 Ik ben je AI Tutor. Ik ben hier om je te helpen met de module "${module.title}". \n\nDeze module gaat over: ${module.description}\n\nWat wil je weten?`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const context: ChatContext = {
        market: undefined,
        profile: undefined
      };

      const nextMessages: ChatMessage[] = [...messages, userMessage];
      const response = await sendChatMessage(nextMessages, {
        ...context,
        profile: {
          displayName: 'Student'
        }
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.reply
        }
      ]);
    } catch (err) {
      console.error('Error:', err);
      setError('Kon antwoord niet ophalen. Probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full md:w-[600px] h-[80vh] md:h-[70vh] bg-white dark:bg-slate-800 rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-700 p-4 md:p-5 flex items-center justify-between bg-gradient-to-r from-primary/10 to-accent/10 dark:from-primary/5 dark:to-accent/5 rounded-t-3xl md:rounded-t-2xl">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">🤖 AI Tutor</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Module: {module.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-br-none'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-none'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl rounded-bl-none px-4 py-3">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-4 md:p-5 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Stel een vraag..."
              className="flex-1 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={loading}
            />
            <button
              onClick={handleSendMessage}
              disabled={loading || !input.trim()}
              className="pill bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 font-medium transition"
            >
              {loading ? '...' : 'Stuur'}
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            De AI tutor helpt met vragen over deze module
          </p>
        </div>
      </div>
    </div>
  );
}
