'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function Field({
  label,
  hint,
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'password';
}) {
  const [showPassword, setShowPassword] = useState(false);
  const inputType = type === 'password' ? (showPassword ? 'text' : 'password') : type;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground)' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            paddingRight: type === 'password' ? '40px' : '14px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--background)',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'oklch(0.54 0.22 263)';
            e.target.style.boxShadow = '0 0 0 3px oklch(0.54 0.22 263 / 0.12)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '';
            e.target.style.boxShadow = '';
          }}
        />
        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted-foreground)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
      {hint && (
        <p style={{ fontSize: '12px', color: 'oklch(0.62 0.01 264)', margin: 0 }}>{hint}</p>
      )}
    </div>
  );
}
