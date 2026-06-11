'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';

function getQuickPrompts(): string[] {
  try {
    const raw = process.env.NEXT_PUBLIC_QUICK_PROMPTS;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* fall through */ }
  return [
    "What do you have in stock?",
    "Show me your best sellers",
    "Help me find something",
    "What would you recommend?",
  ];
}

export function WelcomeScreen({
  personaName,
  merchantName,
  quickPrompts: quickPromptsProp,
  onPromptSelect,
}: {
  personaName: string;
  merchantName: string;
  quickPrompts?: string[];
  onPromptSelect: (prompt: string) => void;
}) {
  const prompts = quickPromptsProp && quickPromptsProp.length > 0 ? quickPromptsProp : getQuickPrompts();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center h-full px-6 pb-32 gap-8"
    >
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold font-display tracking-tight">
          Hi, I&apos;m {personaName}
        </h2>
        <p className="text-sm text-muted-foreground">
          Your AI shopping assistant at {merchantName}
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-md">
        {prompts.map((prompt, i) => (
          <motion.button
            key={prompt}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
            whileHover={{ scale: 1.01, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onPromptSelect(prompt)}
            className={cn(
              'group flex items-center justify-between gap-2',
              'text-sm px-4 py-3.5 rounded-xl text-left',
              'bg-accent text-accent-foreground shadow-sm',
              'hover:bg-accent/80 transition-colors'
            )}
          >
            <span>{prompt}</span>
            <ArrowRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
