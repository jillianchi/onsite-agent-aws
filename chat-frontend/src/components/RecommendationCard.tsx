'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { ProductSummary } from '@/src/lib/types';

export function RecommendationCard({
  product,
  onBuy,
  disabled,
}: {
  product: ProductSummary;
  onBuy: (product: ProductSummary, model: string, color: string) => void;
  disabled?: boolean;
}) {
  const models = product.options?.models ?? [];
  const colors = product.options?.colors ?? [];

  const [selectedModel, setSelectedModel] = useState(models[0] ?? '');
  const [selectedColor, setSelectedColor] = useState(colors[0] ?? '');
  const [imageLoaded, setImageLoaded] = useState(false);

  const canBuy = (!models.length || selectedModel) && (!colors.length || selectedColor);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'w-60 shrink-0 rounded-xl p-3 shadow-sm flex flex-col gap-2.5',
        'bg-accent border border-border font-sans'
      )}
    >
      {/* Image */}
      <div className="relative w-full h-36 rounded-lg overflow-hidden bg-background">
        <div className="absolute inset-0 opacity-15 blur-2xl scale-110 bg-primary" />
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className={cn(
              'relative z-10 w-full h-full object-contain transition-all duration-300',
              imageLoaded ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div className="relative z-10 flex items-center justify-center w-full h-full">
            <span className="text-5xl">🛍️</span>
          </div>
        )}
      </div>

      {/* Name + description */}
      <div>
        <p className="font-semibold text-sm leading-tight text-foreground">{product.name}</p>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mt-0.5">
          {product.description}
        </p>
      </div>

      {/* Model selector */}
      {models.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Model</span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="text-xs bg-background border border-border rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}

      {/* Color selector */}
      {colors.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Color</span>
          <div className="flex flex-wrap gap-1.5">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedColor(c)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  selectedColor === c
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background border border-border text-foreground hover:border-primary/50'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Price + Buy */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-sm font-bold text-foreground">${product.price.toFixed(2)}</span>
        <motion.button
          type="button"
          onClick={() => canBuy && onBuy(product, selectedModel, selectedColor)}
          disabled={!canBuy || disabled}
          whileHover={canBuy && !disabled ? { scale: 1.02 } : {}}
          whileTap={canBuy && !disabled ? { scale: 0.97 } : {}}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold',
            'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
            (!canBuy || disabled) && 'opacity-50 cursor-not-allowed'
          )}
        >
          <ShoppingBag className="size-3" />
          Buy
        </motion.button>
      </div>
    </motion.div>
  );
}
