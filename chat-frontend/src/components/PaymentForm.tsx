'use client';

import { useState } from 'react';
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  AddressElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { useTheme } from 'next-themes';
import { stripePromise } from '@/src/lib/stripe';
import type { PaymentData } from '@/src/lib/types';
import { cn } from '@/src/lib/utils';

function SuccessState() {
  return (
    <div className="py-8 flex flex-col items-center gap-4 text-center">
      <div className="size-16 rounded-full bg-green-500/10 flex items-center justify-center">
        <svg className="size-8 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground text-base">Payment confirmed</p>
        <p className="text-sm text-muted-foreground">Your order is on its way!</p>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50 mt-2">
        <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Secured by Stripe
      </div>
    </div>
  );
}

function CheckoutForm({ amount, onSuccess }: { amount: number; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [expressVisible, setExpressVisible] = useState(false);

  const confirmPayment = async () => {
    if (!stripe || !elements) return false;
    setErrorMessage('');

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message ?? 'Payment failed');
      return false;
    }
    return paymentIntent?.status === 'succeeded';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    const ok = await confirmPayment();
    if (ok) { setStatus('success'); onSuccess(); }
    else setStatus('error');
  };

  const handleExpressConfirm = async () => {
    setStatus('loading');
    const ok = await confirmPayment();
    if (ok) { setStatus('success'); onSuccess(); }
    else setStatus('error');
  };

  if (status === 'success') return <SuccessState />;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Express checkout — Apple Pay, Google Pay, Link */}
      <ExpressCheckoutElement
        onConfirm={handleExpressConfirm}
        onReady={({ availablePaymentMethods }) => {
          if (availablePaymentMethods) setExpressVisible(true);
        }}
        options={{
          paymentMethods: { applePay: 'always', googlePay: 'always', link: 'never' },
          buttonType: { applePay: 'buy', googlePay: 'buy' },
          buttonHeight: 48,
        }}
      />

      {/* Divider — only shown when express methods are available */}
      {expressVisible && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or pay with card</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      <PaymentElement
        options={{
          layout: 'accordion',
          wallets: { applePay: 'never', googlePay: 'never' },
        }}
      />

      <AddressElement options={{ mode: 'shipping' }} />

      {errorMessage && (
        <p className="text-xs text-red-500 dark:text-red-400 px-1">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={!stripe || status === 'loading'}
        className={cn(
          'w-full py-3 px-4 rounded-xl text-sm font-semibold',
          'bg-primary text-primary-foreground',
          'hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-all duration-120'
        )}
      >
        {status === 'loading' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="size-4 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin" />
            Processing…
          </span>
        ) : (
          `Pay $${amount.toFixed(2)}`
        )}
      </button>
    </form>
  );
}

export function PaymentForm({ paymentData, onSuccess }: { paymentData: PaymentData; onSuccess: () => void }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const appearance = {
    theme: (isDark ? 'night' : 'stripe') as 'night' | 'stripe',
    variables: {
      colorPrimary: '#635bff',
      colorBackground: isDark ? '#1c1c1e' : '#ffffff',
      colorText: isDark ? '#f5f5f7' : '#0a0a0a',
      colorTextSecondary: isDark ? '#a0a0ab' : '#6b7280',
      colorDanger: '#ef4444',
      fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
      borderRadius: '8px',
      spacingUnit: '4px',
      fontSizeBase: '14px',
    },
    rules: {
      '.Input': {
        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
        boxShadow: 'none',
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
      },
      '.Input:focus': {
        border: '1px solid #635bff',
        boxShadow: '0 0 0 3px rgba(99,91,255,0.15)',
        outline: 'none',
      },
      '.Label': {
        fontWeight: '500',
        fontSize: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      },
      '.Tab': {
        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fafafa',
      },
      '.Tab--selected': {
        border: '1px solid #635bff',
        backgroundColor: isDark ? 'rgba(99,91,255,0.1)' : 'rgba(99,91,255,0.05)',
        boxShadow: '0 0 0 2px rgba(99,91,255,0.2)',
      },
    },
  };

  return (
    <div className={cn(
      'mt-3 rounded-xl overflow-hidden',
      'border',
      isDark ? 'border-white/10 bg-[#1c1c1e]' : 'border-black/8 bg-white',
      'shadow-sm'
    )}>
      {/* Header */}
      <div className={cn(
        'px-4 py-3 border-b flex items-center justify-between',
        isDark ? 'border-white/8' : 'border-black/6'
      )}>
        <div className="flex items-center gap-2">
          <div className="size-5 rounded-full bg-blurple/10 flex items-center justify-center">
            <svg className="size-3 text-blurple" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z"/>
            </svg>
          </div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Secure Checkout
          </span>
        </div>
        <span className="text-xs font-bold">
          ${paymentData.amount.toFixed(2)}
        </span>
      </div>

      <div className="px-4 py-4">
        <Elements
          stripe={stripePromise}
          options={{ clientSecret: paymentData.clientSecret, appearance }}
        >
          <CheckoutForm amount={paymentData.amount} onSuccess={onSuccess} />
        </Elements>
      </div>
    </div>
  );
}
