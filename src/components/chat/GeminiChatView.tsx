import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Zap,
  Cpu,
  TrendingUp,
  Briefcase,
  AlertCircle,
  HelpCircle,
  FileText,
  Building,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  ChatMessage,
  ChatRole,
  CHAT_ROLES,
  sendChatMessage,
} from '../../services/geminiChatService';
import { useApp } from '../../context/AppContext';

export const GeminiChatView: React.FC = () => {
  const { requirements, vendors, categories } = useApp();

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
        id: 'msg-welcome',
        role: 'model',
        content: `👋 **Welcome to MRO PROCUREMENT SOLUTION AI Assistant!**\n\nI am your intelligent industrial procurement partner powered by Google Gemini.\n\nChoose a persona above or ask me anything about:\n- Sourcing from our **30 industrial material categories**\n- Deep technical cross-referencing and bearing/drive engineering\n- Rapid catalog classification and part number decoding\n- Commercial terms, margin calculations, and RFQ drafting`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'gemini-3.5-flash',
      },
    ];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeRoleConfig = CHAT_ROLES.find((r) => r.id === role) || CHAT_ROLES[0];

  // Persist messages
  useEffect(() => {
    localStorage.setItem('mro_gemini_chat_history', JSON.stringify(messages));
  }, [messages]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (overridePrompt?: string) => {
    const textToSend = overridePrompt || input;
    if (!textToSend.trim() || isLoading) return;

    setErrorMessage(null);
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
      setErrorMessage(err.message || 'Failed to communicate with Gemini API');
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        content: `⚠️ **Unable to complete request:**\n${err.message || 'The server encountered an issue connecting to Gemini.'}\n\nPlease verify that your Gemini API key is configured or retry.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: activeRoleConfig.model,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = () => {
    if (confirm('Clear the entire conversation history?')) {
      const initial: ChatMessage[] = [
        {
          id: 'msg-welcome-new',
          role: 'model',
          content: `Conversation reset. Switched to **${activeRoleConfig.title}** (${activeRoleConfig.model}). How can I assist you with your procurement workflow?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: activeRoleConfig.model,
        },
      ];
      setMessages(initial);
      localStorage.removeItem('mro_gemini_chat_history');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const attachLatestRequirementContext = () => {
    const latestReq = requirements[0];
    if (!latestReq) {
      alert('No active requirements found in database.');
      return;
    }
    const summary = `Context from Requirement ${latestReq.id} for ${latestReq.customerName}:
Items: ${latestReq.items.map((i) => `${i.itemName} (Qty: ${i.quantity} ${i.uom}, Category: ${i.category})`).join(', ')}.
Status: ${latestReq.status}. Required Delivery: ${latestReq.requiredDeliveryDate}.

Please evaluate this requirement and suggest the best procurement and sourcing strategy.`;
    setInput(summary);
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4 flex flex-col h-[calc(100vh-4.5rem)]">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>MRO Procurement AI Assistant</span>
                <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${activeRoleConfig.badgeColor}`}>
                  {activeRoleConfig.badge}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-turn procurement AI assistant with specialized engineering, sourcing, and commercial roles
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={attachLatestRequirementContext}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-2xs"
            title="Attach latest active requirement summary into prompt"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Attach Active Requirement</span>
          </button>

          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            title="Clear conversation history"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Clear History</span>
          </button>
        </div>
      </div>

      {/* Role Preset Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
        {CHAT_ROLES.map((r) => {
          const isActive = role === r.id;
          const Icon =
            r.id === 'technical'
              ? Cpu
              : r.id === 'fast'
              ? Zap
              : r.id === 'commercial'
              ? TrendingUp
              : Briefcase;

          return (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              className={`p-3 rounded-xl border text-left transition-all relative ${
                isActive
                  ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                  <span className={`text-xs font-bold ${isActive ? 'text-blue-900' : 'text-slate-800'}`}>
                    {r.name}
                  </span>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 line-clamp-1">{r.description}</div>
              <div className="mt-1 flex items-center justify-between text-[9px] font-mono font-semibold">
                <span className={isActive ? 'text-blue-700 font-bold' : 'text-slate-400'}>
                  {r.model}
                </span>
                {isActive && (
                  <span className="px-1.5 py-0.2 rounded bg-blue-600 text-white font-sans text-[8px] uppercase font-bold">
                    Active
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Chat Thread Box */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col min-h-0">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.map((msg) => {
            const isModel = msg.role === 'model';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isModel ? 'items-start' : 'items-start flex-row-reverse'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white shadow-2xs ${
                    isModel
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-600'
                      : 'bg-slate-800'
                  }`}
                >
                  {isModel ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                {/* Bubble */}
                <div className={`max-w-[85%] sm:max-w-[78%] space-y-1.5 ${isModel ? '' : 'text-right'}`}>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium px-1">
                    <span className="font-semibold text-slate-600">
                      {isModel ? 'MRO AI Assistant' : 'You'}
                    </span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                    {msg.modelUsed && (
                      <span className="font-mono text-[9px] px-1.5 py-0.2 bg-slate-100 rounded text-slate-500">
                        {msg.modelUsed}
                      </span>
                    )}
                  </div>

                  <div
                    className={`p-4 rounded-2xl text-xs sm:text-[13px] leading-relaxed relative group ${
                      isModel
                        ? 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-sm'
                        : 'bg-blue-600 text-white rounded-tr-sm shadow-xs'
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">
                      {msg.content}
                    </div>

                    {/* Copy Button */}
                    {isModel && (
                      <div className="pt-2 mt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Gemini Multi-turn Session</span>
                        <button
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className="flex items-center gap-1 hover:text-slate-700 transition-colors"
                          title="Copy response"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-600 font-medium">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl rounded-tl-sm text-xs text-slate-600 space-y-2">
                <div className="flex items-center gap-2 text-blue-600 font-semibold">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating response using {activeRoleConfig.model}...</span>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-[11px] shrink-0">
          <span className="text-slate-400 font-medium shrink-0 flex items-center gap-1">
            <HelpCircle className="w-3 h-3" />
            <span>Suggested:</span>
          </span>
          {activeRoleConfig.samplePrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              disabled={isLoading}
              className="px-2.5 py-1 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-full font-medium shrink-0 transition-colors shadow-2xs disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0">
          <div className="flex items-end gap-2 bg-slate-50 border border-slate-300 rounded-xl p-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-all">
            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeRoleConfig.placeholder}
              className="flex-1 bg-transparent text-xs sm:text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-hidden"
              disabled={isLoading}
            />

            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg transition-all shadow-xs shrink-0"
              title="Send message (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 mt-1.5">
            <span>Press <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for new line</span>
            <span>Powered by @google/genai SDK</span>
          </div>
        </div>
      </div>
    </div>
  );
};
