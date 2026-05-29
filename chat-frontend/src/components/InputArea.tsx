'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { ArrowUp, MessageCircleCode, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/lib/utils';

function getQuickPrompts(): string[] {
  try {
    const raw = process.env.NEXT_PUBLIC_QUICK_PROMPTS;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* fall through */ }
  return [];
}

const QUICK_PROMPTS = getQuickPrompts();

export function InputArea({
  onSend,
  isLoading,
}: {
  onSend: (message: string) => void;
  isLoading: boolean;
}) {
  const [value, setValue] = useState('');
  const [isPromptsOpen, setIsPromptsOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '48px';
    el.style.height = `${Math.min(el.scrollHeight, 164)}px`;
  }, [value]);

  // Close prompts on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsPromptsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSubmit = useCallback(() => {
    const msg = value.trim();
    if (!msg || isLoading) return;
    onSend(msg);
    setValue('');
  }, [value, isLoading, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePromptSelect = (prompt: string) => {
    setIsPromptsOpen(false);
    onSend(prompt);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      {/* Gradient fade */}
      <div className="h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />

      <div className="w-full max-w-3xl px-4 pb-4 mx-auto bg-background font-sans">
        <div className="relative rounded-xl shadow-2xl border border-border bg-background dark:bg-card">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message your assistant…"
            rows={1}
            className={cn(
              'w-full resize-none px-4 pt-3.5 pb-2 text-sm',
              'bg-transparent outline-none ring-0 border-none',
              'placeholder:text-muted-foreground/60',
              'min-h-12 max-h-41'
            )}
            style={{ minHeight: '48px', maxHeight: '164px' }}
          />

          <div className="flex items-center gap-2 px-3 pb-3 pt-1 border-t border-border/40">
            {/* Quick prompts */}
            <div className="relative" ref={popoverRef}>
              <button
                type="button"
                onClick={() => setIsPromptsOpen((o) => !o)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                  'border border-border bg-background text-muted-foreground',
                  'hover:text-foreground hover:bg-accent transition-colors'
                )}
              >
                <MessageCircleCode className="size-3.5" />
                <span>Prompts</span>
              </button>

              <AnimatePresence>
                {isPromptsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      'absolute bottom-full left-0 mb-2',
                      'w-72 rounded-xl border border-border bg-card shadow-xl p-1.5',
                      'z-50'
                    )}
                  >
                    <div className="flex items-center justify-between px-2 py-1.5 mb-1">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Quick prompts
                      </span>
                      <button
                        onClick={() => setIsPromptsOpen(false)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handlePromptSelect(prompt)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 rounded-lg text-sm',
                          'hover:bg-accent text-foreground transition-colors'
                        )}
                      >
                        {prompt}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Submit button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!value.trim() || isLoading}
              className={cn(
                'ml-auto flex items-center justify-center',
                'size-8 rounded-full bg-primary text-primary-foreground',
                'hover:bg-primary/90 disabled:opacity-40',
                'transition-colors'
              )}
              aria-label="Send message"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
