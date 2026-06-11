'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export const DEMO_PRESETS = {
  generic: {
    key: 'generic',
    name: 'Dunder Mifflin',
    personaName: 'Recyclops',
    description: 'Office supplies & merch',
    emoji: '📄',
  },
  ecoflow: {
    key: 'ecoflow',
    name: 'EcoFlow',
    personaName: 'Spark',
    description: 'Portable power & solar',
    emoji: '⚡',
  },
} as const;

export type PresetKey = keyof typeof DEMO_PRESETS;

export function DemoSwitcher({
  activePreset,
  onSwitch,
}: {
  activePreset: PresetKey;
  onSwitch: (preset: PresetKey) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-24 right-4 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute bottom-12 right-0 mb-2 w-56',
              'rounded-xl border border-border bg-card shadow-xl p-1.5'
            )}
          >
            <div className="flex items-center justify-between px-2 py-1.5 mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Demo preset
              </span>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            </div>

            {Object.values(DEMO_PRESETS).map((preset) => (
              <button
                key={preset.key}
                onClick={() => {
                  onSwitch(preset.key);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                  activePreset === preset.key
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-accent text-foreground'
                )}
              >
                <span className="text-lg">{preset.emoji}</span>
                <div>
                  <p className="text-sm font-medium leading-tight">{preset.name}</p>
                  <p className="text-xs text-muted-foreground">{preset.description}</p>
                </div>
                {activePreset === preset.key && (
                  <div className="ml-auto size-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          'size-10 rounded-full shadow-lg flex items-center justify-center',
          'bg-card border border-border text-muted-foreground',
          'hover:text-foreground hover:border-primary/50 transition-colors'
        )}
        title="Switch demo preset"
      >
        <Layers className="size-4" />
      </motion.button>
    </div>
  );
}
