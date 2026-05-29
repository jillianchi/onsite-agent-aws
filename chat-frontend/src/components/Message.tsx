'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/src/lib/utils';
import type { ChatMessage } from '@/src/lib/types';

export function Message({
  message,
  children,
}: {
  message: ChatMessage;
  children?: React.ReactNode;
}) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex w-full items-start gap-3 py-3',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <div className="flex-shrink-0 size-7 rounded-full bg-primary flex items-center justify-center mt-0.5">
          <span className="text-primary-foreground text-[10px] font-bold font-display">AI</span>
        </div>
      )}

      <div className="flex flex-col gap-2 max-w-[80%]">
        {message.content && (
          <div
            className={cn(
              'text-sm overflow-hidden',
              isUser
                ? 'bg-primary text-primary-foreground px-4 py-3 rounded-2xl shadow-sm'
                : 'text-foreground border-l-2 border-foreground/10 pl-3 py-1'
            )}
          >
            {isUser ? (
              <span>{message.content}</span>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
        {children}
      </div>

      {isUser && (
        <div className="flex-shrink-0 size-7 rounded-full bg-accent flex items-center justify-center mt-0.5">
          <span className="text-accent-foreground text-[10px] font-bold">U</span>
        </div>
      )}
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex-shrink-0 size-7 rounded-full bg-primary flex items-center justify-center">
        <span className="text-primary-foreground text-[10px] font-bold font-display">AI</span>
      </div>
      <div className="border-l-2 border-foreground/10 pl-3 py-3 flex items-center">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 rounded-full bg-foreground/40 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
