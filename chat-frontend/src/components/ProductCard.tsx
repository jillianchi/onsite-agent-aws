'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { ProductConfig } from '@/src/lib/types';

// Accent color by category
const CATEGORY_COLORS: Record<string, string> = {
  cases: '#635bff',
  floral: '#f472b6',
  abstract: '#818cf8',
  animals: '#fb923c',
  apparel: '#34d399',
  accessories: '#facc15',
  electronics: '#38bdf8',
};

export function ProductCard({
  config,
  onCheckout,
}: {
  config: ProductConfig;
  onCheckout: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const accentColor = CATEGORY_COLORS[config.category?.toLowerCase() ?? ''] ?? '#635bff';

  // Build a readable title from available fields
  const subtitle = [config.model, config.color, config.designCategory]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={cn(
          'w-72 shrink-0 rounded-xl p-3 shadow-sm flex flex-col gap-2.5',
          'bg-accent border border-border font-sans'
        )}
      >
        {/* Image */}
        <div
          className="relative w-full h-44 rounded-lg overflow-hidden cursor-zoom-in bg-background"
          onClick={() => setExpanded(true)}
        >
          <div
            className="absolute inset-0 opacity-20 blur-2xl scale-110"
            style={{ background: accentColor }}
          />

          {config.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.imageUrl}
              alt={config.productName}
              className={cn(
                'relative z-10 w-full h-full object-contain transition-all duration-300 hover:scale-105',
                imageLoaded ? 'opacity-100' : 'opacity-0'
              )}
              onLoad={() => setImageLoaded(true)}
            />
          ) : (
            <div className="relative z-10 flex items-center justify-center w-full h-full">
              <span className="text-6xl">🛍️</span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col gap-1 flex-1">
          <p className="font-semibold text-sm leading-tight text-foreground">
            {config.productName}
          </p>

          {subtitle && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {subtitle}
              {config.customText ? ` · "${config.customText}"` : ''}
            </p>
          )}

          <p className="text-base font-bold text-foreground mt-0.5">
            ${config.price.toFixed(2)}
          </p>
        </div>

        {/* Checkout button */}
        <motion.button
          type="button"
          onClick={onCheckout}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className={cn(
            'w-full flex items-center justify-center gap-2',
            'bg-primary text-primary-foreground',
            'px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide',
            'hover:bg-primary/90 transition-colors'
          )}
        >
          <ShoppingBag className="size-3.5" />
          Checkout
        </motion.button>
      </motion.div>

      {/* Expanded image overlay */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => setExpanded(false)}
            style={{ margin: 0 }}
          >
            <div className="absolute inset-0 bg-background/90 backdrop-blur-md" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 bg-accent rounded-2xl shadow-2xl overflow-hidden max-w-sm w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative bg-background h-64 flex items-center justify-center">
                <div
                  className="absolute inset-0 opacity-20 blur-3xl"
                  style={{ background: accentColor }}
                />
                {config.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={config.imageUrl}
                    alt={config.productName}
                    className="relative z-10 w-full h-full object-contain"
                  />
                ) : (
                  <span className="relative z-10 text-8xl">🛍️</span>
                )}
              </div>
              <div className="p-4 space-y-1">
                <p className="font-semibold font-display">{config.productName}</p>
                {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
                <p className="text-lg font-bold">${config.price.toFixed(2)}</p>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="absolute top-3 right-3 size-8 rounded-full bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
