'use client';

import { useState } from 'react';
import { X, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { ConversationTurn } from '@/src/lib/types';

interface DebugEntry {
  timestamp: string;
  request: { message: string; historyLength: number };
  response: unknown;
}

export function DebugPanel({
  isOpen,
  onClose,
  conversationHistory,
  debugLog,
}: {
  isOpen: boolean;
  onClose: () => void;
  conversationHistory: ConversationTurn[];
  debugLog: DebugEntry[];
}) {
  const [activeTab, setActiveTab] = useState<'log' | 'history'>('log');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  return (
    <div className={cn(
      'fixed inset-y-0 right-0 z-50 flex flex-col',
      'w-full max-w-lg',
      'bg-card border-l border-border shadow-2xl',
      'font-mono text-xs'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm font-sans">Debug Console</span>
          <div className="flex rounded-md overflow-hidden border border-border">
            {(['log', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-3 py-1 text-xs capitalize',
                  activeTab === tab
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab === 'log' ? `API Log (${debugLog.length})` : `History (${conversationHistory.length})`}
              </button>
            ))}
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {activeTab === 'log' ? (
          <div className="divide-y divide-border">
            {debugLog.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground font-sans text-sm">
                No API calls yet. Send a message to see the logs.
              </div>
            ) : (
              [...debugLog].reverse().map((entry, i) => {
                const idx = debugLog.length - 1 - i;
                const isExpanded = expandedIndex === idx;
                return (
                  <div key={idx}>
                    <button
                      onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                      className="w-full flex items-start gap-2 px-4 py-3 hover:bg-accent/50 text-left"
                    >
                      {isExpanded
                        ? <ChevronDown className="size-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                        : <ChevronRight className="size-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] text-muted-foreground">{entry.timestamp}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/10 text-green-600 dark:text-green-400">POST /chat</span>
                        </div>
                        <div className="text-foreground truncate">
                          &ldquo;{entry.request.message}&rdquo;
                        </div>
                        <div className="text-muted-foreground mt-0.5">
                          history: {entry.request.historyLength} turns
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 bg-accent/20">
                        <Section title="Request">
                          <Pre value={entry.request} />
                        </Section>
                        <Section title="Response">
                          <Pre value={entry.response} />
                        </Section>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {conversationHistory.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground font-sans text-sm">
                No conversation history yet.
              </div>
            ) : (
              conversationHistory.map((turn, i) => (
                <div key={i} className="px-4 py-3">
                  <span className={cn(
                    'inline-block text-[10px] px-1.5 py-0.5 rounded mb-1.5 font-semibold uppercase',
                    turn.role === 'user'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {turn.role}
                  </span>
                  <Pre value={turn.content} />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{title}</div>
      {children}
    </div>
  );
}

function Pre({ value }: { value: unknown }) {
  return (
    <pre className="text-[11px] bg-background rounded p-2 overflow-x-auto text-foreground border border-border whitespace-pre-wrap break-all">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export type { DebugEntry };
