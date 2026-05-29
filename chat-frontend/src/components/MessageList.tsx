'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Message, TypingIndicator } from './Message';
import { PaymentForm } from './PaymentForm';
import { ProductCard } from './ProductCard';
import { RecommendationCard } from './RecommendationCard';
import { WelcomeScreen } from './WelcomeScreen';
import type { ChatMessage, ProductSummary } from '@/src/lib/types';
import { cn } from '@/src/lib/utils';

export function MessageList({
  messages,
  isLoading,
  personaName,
  merchantName,
  onPromptSelect,
  onPaymentSuccess,
  onCheckout,
  onProductBuy,
}: {
  messages: ChatMessage[];
  isLoading: boolean;
  personaName: string;
  merchantName: string;
  onPromptSelect: (prompt: string) => void;
  onPaymentSuccess: (productName?: string) => void;
  onCheckout: () => void;
  onProductBuy: (product: ProductSummary, model: string, color: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isAtBottom]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  };

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto scrollbar-hide px-4 md:px-6"
      >
        <div className="max-w-3xl mx-auto py-6 pb-40">
          {isEmpty ? (
            <WelcomeScreen
              personaName={personaName}
              merchantName={merchantName}
              onPromptSelect={onPromptSelect}
            />
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id}>
                  {/* Only show text bubble if there's content AND no product list (cards replace the listing) */}
                  {(msg.content || (msg.role === 'assistant' && msg.productConfig && !msg.paymentData)) && (
                    <Message message={msg}>
                      {msg.role === 'assistant' && msg.productConfig && !msg.paymentData && (
                        <ProductCard config={msg.productConfig} onCheckout={onCheckout} />
                      )}
                    </Message>
                  )}

                  {/* Recommendation cards — shown instead of the AI listing text */}
                  {msg.role === 'assistant' && msg.productList && msg.productList.length > 0 && (
                    <div className="flex gap-3 overflow-x-auto pb-3 pl-10 scrollbar-hide mt-2">
                      {msg.productList.map((product) => (
                        <RecommendationCard
                          key={product.id}
                          product={product}
                          onBuy={onProductBuy}
                          disabled={isLoading}
                        />
                      ))}
                    </div>
                  )}

                  {/* Payment form — outside bubble for full width */}
                  {msg.role === 'assistant' && msg.paymentData && (
                    <div className="pl-10 mt-1">
                      <PaymentForm
                        paymentData={msg.paymentData}
                        onSuccess={() => onPaymentSuccess(msg.paymentData?.product?.productName)}
                      />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && <TypingIndicator />}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {!isAtBottom && (
        <button
          onClick={() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            setIsAtBottom(true);
          }}
          className={cn(
            'absolute bottom-4 left-1/2 -translate-x-1/2',
            'size-8 rounded-full bg-card border border-border shadow-lg',
            'flex items-center justify-center',
            'text-muted-foreground hover:text-foreground transition-colors z-10'
          )}
        >
          <ChevronDown className="size-4" />
        </button>
      )}
    </div>
  );
}
