'use client';

import { useState, useCallback, useEffect } from 'react';
import { RotateCcw, Terminal } from 'lucide-react';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { ThemeToggle } from './ThemeToggle';
import { DebugPanel, type DebugEntry } from './DebugPanel';
import { sendMessage } from '@/src/lib/api';
import type { ChatMessage, ConversationTurn, ProductSummary } from '@/src/lib/types';
import { cn } from '@/src/lib/utils';
import { DemoSwitcher, DEMO_PRESETS, type PresetKey } from './DemoSwitcher';

const DEFAULT_MERCHANT_NAME = process.env.NEXT_PUBLIC_MERCHANT_NAME || 'My Store';
const DEFAULT_PERSONA_NAME = process.env.NEXT_PUBLIC_AI_PERSONA_NAME || 'Alex';
const DEFAULT_PERSONA_DESCRIPTION = process.env.NEXT_PUBLIC_AI_PERSONA_DESCRIPTION || 'Your shopping assistant';
const STORAGE_KEY = 'onsite_agent_conversation';

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [activePreset, setActivePreset] = useState<PresetKey>('ecoflow');

  const preset = DEMO_PRESETS[activePreset];
  const MERCHANT_NAME = preset?.name || DEFAULT_MERCHANT_NAME;
  const PERSONA_NAME = preset?.personaName || DEFAULT_PERSONA_NAME;
  const PERSONA_DESCRIPTION = DEFAULT_PERSONA_DESCRIPTION;

  const handleSwitchPreset = useCallback((newPreset: PresetKey) => {
    setActivePreset(newPreset);
    setMessages([]);
    setConversationHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugLog, setDebugLog] = useState<DebugEntry[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { messages: m, history: h } = JSON.parse(saved);
        setMessages(m ?? []);
        setConversationHistory(h ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      messages,
      history: conversationHistory,
    }));
  }, [messages, conversationHistory]);

  const handleSend = useCallback(async (text: string) => {
    if (isLoading) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const data = await sendMessage(text, conversationHistory, activePreset);

      setDebugLog((prev) => [...prev, {
        timestamp: new Date().toLocaleTimeString(),
        request: { message: text, historyLength: conversationHistory.length },
        response: data,
      }]);

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        paymentData: data.paymentData,
        productConfig: data.config,
        productList: data.productList ?? undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setConversationHistory(data.conversationHistory);
    } catch {
      setMessages((prev) => [...prev, {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, conversationHistory]);

  const handleNewChat = () => {
    setMessages([]);
    setConversationHistory([]);
    setDebugLog([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  // Called when user clicks Buy on a recommendation card — silent, goes straight to payment
  const handleProductBuy = useCallback(async (product: ProductSummary, model: string, color: string) => {
    if (isLoading) return;
    setIsLoading(true);

    const buyMessage = `DIRECT_BUY: productId=${product.id} name=${product.name} model=${model} color=${color} price=${product.price}`;

    try {
      const data = await sendMessage(buyMessage, conversationHistory, activePreset);
      setDebugLog((prev) => [...prev, {
        timestamp: new Date().toLocaleTimeString(),
        request: { message: buyMessage, historyLength: conversationHistory.length },
        response: data,
      }]);
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.paymentData ? '' : data.message,
        paymentData: data.paymentData,
        productConfig: data.config,
        productList: data.productList ?? undefined,
      }]);
      setConversationHistory(data.conversationHistory);
    } catch {
      setMessages((prev) => [...prev, {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, conversationHistory]);

  // Called by the ProductCard checkout button — silent, no user bubble
  const handleCheckout = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const data = await sendMessage("proceed to checkout", conversationHistory, activePreset);
      setDebugLog((prev) => [...prev, {
        timestamp: new Date().toLocaleTimeString(),
        request: { message: 'checkout', historyLength: conversationHistory.length },
        response: data,
      }]);
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: '',
        paymentData: data.paymentData,
        productConfig: data.config,
      }]);
      setConversationHistory(data.conversationHistory);
    } catch {
      setMessages((prev) => [...prev, {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, something went wrong starting checkout. Please try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, conversationHistory]);

  // Called after Stripe payment succeeds — get AI to respond with confirmation
  const handlePaymentSuccess = useCallback(async (productName?: string) => {
    try {
      const msg = productName
        ? `PAYMENT_CONFIRMED: product="${productName}"`
        : 'PAYMENT_CONFIRMED';
      const data = await sendMessage(msg, conversationHistory, activePreset);
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.message,
      }]);
      setConversationHistory(data.conversationHistory);
    } catch { /* silent — payment already succeeded */ }
  }, [conversationHistory]);

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex-shrink-0 h-14 flex items-center justify-between px-5 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="font-display font-semibold text-sm tracking-tight">{MERCHANT_NAME}</span>
          <span className="text-xs text-muted-foreground hidden sm:block">{PERSONA_DESCRIPTION}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-accent"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">New chat</span>
          </button>
          <button
            onClick={() => setDebugOpen((o) => !o)}
            className={cn(
              'flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md transition-colors',
              debugOpen
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
            title="Debug console"
          >
            <Terminal className="size-3.5" />
            <span className="hidden sm:inline">Debug</span>
            {debugLog.length > 0 && (
              <span className={cn(
                'text-[10px] px-1 rounded-full',
                debugOpen ? 'bg-primary-foreground/20' : 'bg-primary/10 text-primary'
              )}>
                {debugLog.length}
              </span>
            )}
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-col flex-1 overflow-hidden">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          personaName={PERSONA_NAME}
          merchantName={MERCHANT_NAME}
          quickPrompts={preset.quickPrompts as unknown as string[]}
          onPromptSelect={handleSend}
          onPaymentSuccess={handlePaymentSuccess}
          onCheckout={handleCheckout}
          onProductBuy={handleProductBuy}
        />
        <InputArea onSend={handleSend} isLoading={isLoading} quickPrompts={preset.quickPrompts as unknown as string[]} />
      </div>

      <DebugPanel
        isOpen={debugOpen}
        onClose={() => setDebugOpen(false)}
        conversationHistory={conversationHistory}
        debugLog={debugLog}
      />

      <DemoSwitcher activePreset={activePreset} onSwitch={handleSwitchPreset} />
    </div>
  );
}
