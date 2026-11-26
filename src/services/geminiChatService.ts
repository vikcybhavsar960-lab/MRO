import { fetchApi } from '../utils/apiClient';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  modelUsed?: string;
}

export type ChatRole = 'general' | 'technical' | 'fast' | 'commercial';

export interface ChatRoleOption {
  id: ChatRole;
  name: string;
  title: string;
  model: 'gemini-3.5-flash' | 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite';
  badge: string;
  badgeColor: string;
  description: string;
  placeholder: string;
  samplePrompts: string[];
}

export const CHAT_ROLES: ChatRoleOption[] = [
  {
    id: 'general',
    name: 'Procurement Advisor',
    title: 'General Procurement & Vendor Advisor',
    model: 'gemini-3.5-flash',
    badge: 'gemini-3.5-flash',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'General procurement tasks, supplier evaluation, RFQ inquiries, and catalog recommendations.',
    placeholder: 'Ask about sourcing, supplier qualification, RFQ wording...',
    samplePrompts: [
      'What are the best domestic manufacturers for industrial valves in India?',
      'Draft a formal RFQ email for 50 units of Festo pneumatic cylinders with 2-week delivery.',
      'How should I evaluate vendor quotation payment terms between 30 days net vs LC?',
      'Suggest inspection checklist items for high-pressure hydraulic pump dispatch.',
    ],
  },
  {
    id: 'technical',
    name: 'MRO Technical Engineer',
    title: 'Deep Reasoning MRO Engineer',
    model: 'gemini-3.1-pro-preview',
    badge: 'gemini-3.1-pro-preview (Complex)',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'Complex technical reasoning, clearance calculation, obsolete part cross-referencing, and mechanical engineering.',
    placeholder: 'Ask complex technical MRO questions, bearing clearances, PLC architectures...',
    samplePrompts: [
      'Compare SKF 6206-2RS-C3 vs FAG 6206-ZZ: clearances, temperature limits, and grease life.',
      'An old conveyor uses Siemens S7-300 with CPU 314C. What is the exact migration path to S7-1200 or S7-1500?',
      'Calculate safety factor and pitch diameter for Timing Belt HTD 424-8M running at 1440 RPM with a 5.5 kW motor.',
      'Recommend exact seal material (Viton vs Nitrile vs PTFE) for hydraulic oil pumps operating at 130°C and 250 Bar.',
    ],
  },
  {
    id: 'fast',
    name: 'Rapid Classifier',
    title: 'Fast Catalog & Part Number Lookup',
    model: 'gemini-3.1-flash-lite',
    badge: 'gemini-3.1-flash-lite (Fast)',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    description: 'Ultra-fast responses for instant category mapping, part number decoding, and unit conversions.',
    placeholder: 'Quick part code lookup, category classification, instant conversion...',
    samplePrompts: [
      'Decode bearing code: 22212 EK / C3 W33',
      'Classify item: Siemens 3RT2015-1BB41 Contactor into our 30 material categories',
      'Convert 35 Bar to PSI and kg/cm²',
      'Quick list of 5 standard deep groove ball bearing sizes with 30mm bore diameter',
    ],
  },
  {
    id: 'commercial',
    name: 'Commercial Auditor',
    title: 'Commercial Terms & Margin Analyst',
    model: 'gemini-3.5-flash',
    badge: 'gemini-3.5-flash',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: 'Analysis of profit margins, commercial lock validations, delivery terms, and buyer-supplier negotiations.',
    placeholder: 'Ask about gross margin verification, payment terms risk, contract clauses...',
    samplePrompts: [
      'Customer target budget is ₹42,000 and best vendor rate is ₹36,500. Calculate margin percentage and GST implications.',
      'Explain difference and freight cost responsibility between Ex-Works and FOR Destination delivery.',
      'What penalty clause wording should we include in Vendor PO for late delivery penalty of 0.5% per week?',
      'How to structure a price-escalation clause for raw steel and copper price volatility?',
    ],
  },
];

/**
 * Sends conversation history to the server-side Gemini chat endpoint
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  role: ChatRole = 'general',
  customModel?: string
): Promise<{ reply: string; modelUsed: string; roleUsed: string }> {
  const payload = {
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    role,
    customModel,
  };

  const response = await fetchApi('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    timeoutMs: 45000,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server returned HTTP status ${response.status}`);
  }

  return response.json();
}
