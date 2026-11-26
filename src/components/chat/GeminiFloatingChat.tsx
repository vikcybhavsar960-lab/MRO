import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  Maximize2,
  Minimize2,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';
import {
  ChatMessage,
  ChatRole,
  CHAT_ROLES,
  sendChatMessage,
} from '../../services/geminiChatService';

interface GeminiFloatingChatProps {
  onOpenFullView?: () => void;
}

export const GeminiFloatingChat: React.FC<GeminiFloatingChatProps> = ({ onOpenFullView }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState<ChatRole>('general');
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('mro_gemini_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      {
        id: 'msg-float-init',
        role: 'model',
        content: 'Hi! I am your MRO PROCUREMENT SOLUTION Gemini AI assistant. How can I help with your industrial parts, suppliers, or RFQs today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'gemini-3.5-flash',
      },
    ];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeRoleConfig = CHAT_ROLES.find((r) => r.id === role) || CHAT_ROLES[0];

  useEffect(() => {
    localStorage.setItem('mro_gemini_chat_history', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage(newHistory, role);
      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'model',
        content: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: response.modelUsed,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        content: `⚠️ Error: ${err.message || 'Failed to connect to Gemini API.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: activeRoleConfig.model,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full shadow-xl shadow-blue-500/25 transition-all hover:scale-105 group border border-white/20"
          title="Open Gemini Procurement AI Assistant"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
          </div>
          <span className="text-xs font-bold tracking-tight">AI Assistant</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-mono">
            Gemini
          </span>
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-80 sm:w-96 h-[32rem] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-150">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs flex items-center gap-1.5">
                  <span>MRO AI Assistant</span>
                  <span className="text-[9px] font-mono font-normal px-1.5 py-0.2 rounded bg-blue-600/40 text-blue-200">
                    {activeRoleConfig.model}
                  </span>
                </h4>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span>{activeRoleConfig.name}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {onOpenFullView && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onOpenFullView();
                  }}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10"
                  title="Expand to Full View"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10"
                title="Close Chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Role Selector */}
          <div className="px-2 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center gap-1 overflow-x-auto text-[10px] shrink-0">
            {CHAT_ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRole(r.id)}
                className={`px-2 py-1 rounded-md font-semibold shrink-0 transition-colors ${
                  role === r.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>

          {/* Message Thread */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs bg-slate-50/50">
            {messages.map((m) => {
              const isModel = m.role === 'model';
              return (
                <div
                  key={m.id}
                  className={`flex gap-2 ${isModel ? 'items-start' : 'items-start flex-row-reverse'}`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-white text-[10px] ${
                      isModel ? 'bg-blue-600' : 'bg-slate-800'
                    }`}
                  >
                    {isModel ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                  </div>

                  <div className={`max-w-[85%] space-y-0.5 ${isModel ? '' : 'text-right'}`}>
                    <div
                      className={`p-2.5 rounded-xl leading-relaxed whitespace-pre-wrap ${
                        isModel
                          ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs shadow-2xs'
                          : 'bg-blue-600 text-white rounded-tr-xs'
                      }`}
                    >
                      {m.content}
                    </div>
                    <div className="text-[9px] text-slate-400 px-1">{m.timestamp}</div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                <span>Thinking ({activeRoleConfig.model})...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div className="p-2.5 bg-white border-t border-slate-200 shrink-0">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activeRoleConfig.placeholder}
                className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden"
                disabled={isLoading}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="p-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
