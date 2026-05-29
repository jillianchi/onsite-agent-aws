'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Store, Package, CreditCard, Cloud, ChevronDown, Plus, X, CheckCircle, XCircle, Copy } from 'lucide-react';
import { Eye, EyeOff } from 'lucide-react';
import type { WizardState, CatalogProduct } from '@/src/lib/types';

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

const AWS_REGIONS = [
  'us-east-1','us-east-2','us-west-1','us-west-2',
  'eu-west-1','eu-west-2','eu-central-1',
  'ap-southeast-1','ap-southeast-2','ap-northeast-1',
];

const INITIAL: WizardState = {
  step: 0,
  store: { merchantName: '', personaName: '', personaDescription: '' },
  catalog: {
    storeDescription: '',
    currency: 'usd',
    quickPrompts: ['', '', '', ''],
    products: [],
  },
  stripe: { publishableKey: '', secretKey: '' },
  aws: { region: 'us-east-1', accessKeyId: '', secretAccessKey: '', stackName: 'onsite-agent' },
};

function Field({ label, placeholder, value, onChange, type = 'text', hint }: {
  label: string; placeholder?: string; value: string;
  onChange: (v: string) => void; type?: 'text' | 'password'; hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <div className={type === 'password' ? 'field-input-wrap' : undefined}>
        <input
          type={type === 'password' ? (show ? 'text' : 'password') : 'text'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field-input"
        />
        {type === 'password' && (
          <button type="button" className="field-eye-btn" tabIndex={-1} onClick={() => setShow(v => !v)}>
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

function Section({ icon: Icon, title, complete, open, summary, onToggle, children }: {
  icon: React.ElementType; title: string; complete: boolean;
  open: boolean; summary?: string; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className={`setup-section${open ? ' is-open' : ''}`}>
      <button type="button" className="section-header-btn" onClick={onToggle}>
        <div className="section-icon"><Icon size={14} /></div>
        <div className="section-title">
          <span className="section-title-text">{title}</span>
          {!open && complete && summary && <span className="section-summary">{summary}</span>}
        </div>
        <span className={`completion-dot${complete ? ' complete' : ''}`} />
        <ChevronDown size={14} className={`chevron-icon${open ? ' open' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="section-body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProductForm({ onAdd }: { onAdd: (p: CatalogProduct) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  function handleAdd() {
    if (!name || !price) return;
    onAdd({ id: Date.now().toString(), name, price: parseFloat(price), description, category, imageUrl: '', options: {} });
    setName(''); setPrice(''); setDescription(''); setCategory('');
    setOpen(false);
  }

  return (
    <div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            style={{ overflow: 'hidden', marginBottom: 8 }}
          >
            <div className="product-form-card">
              <div className="two-col">
                <Field label="Name" value={name} onChange={setName} placeholder="e.g. Classic Tee" />
                <Field label="Price (USD)" value={price} onChange={setPrice} placeholder="29.99" />
              </div>
              <Field label="Description" value={description} onChange={setDescription} placeholder="Optional" />
              <Field label="Category" value={category} onChange={setCategory} placeholder="e.g. apparel" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="mini-btn primary" onClick={handleAdd} disabled={!name || !price}>Add</button>
                <button type="button" className="mini-btn ghost" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!open && (
        <button type="button" className="add-product-btn" onClick={() => setOpen(true)}>
          <Plus size={13} /> Add product
        </button>
      )}
    </div>
  );
}

function InfraRow({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div className="infra-row">
      <span className="infra-row-label">{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="infra-row-value infra-row-link">{value}</a>
      ) : (
        <span className="infra-row-value">{value}</span>
      )}
    </div>
  );
}

export default function SetupPage() {
  const [state, setState] = useState<WizardState>(INITIAL);
  const [open, setOpen] = useState({ store: true, products: false, stripe: false, aws: false });
  const [deploying, setDeploying] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [deployResult, setDeployResult] = useState<'success' | 'error' | null>(null);
  const [infra, setInfra] = useState<{ frontendUrl?: string; apiEndpoint?: string; lambdaName?: string; bucketName?: string; stackName?: string } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Load current catalog.json on mount so quickPrompts/products aren't overwritten by hardcoded defaults
  useEffect(() => {
    fetch('/api/load-catalog')
      .then(r => r.json())
      .then(catalog => {
        if (catalog.quickPrompts?.length) {
          setState(s => ({ ...s, catalog: { ...s.catalog, quickPrompts: catalog.quickPrompts } }));
        }
        if (catalog.products?.length) {
          setState(s => ({ ...s, catalog: { ...s.catalog, products: catalog.products } }));
        }
        if (catalog.storeDescription) {
          setState(s => ({ ...s, catalog: { ...s.catalog, storeDescription: catalog.storeDescription } }));
        }
      })
      .catch(() => { /* use defaults if file unreadable */ });
  }, []);

  const upd = (key: keyof WizardState, val: object) =>
    setState(s => ({ ...s, [key]: { ...(s[key] as object), ...val } }));
  const toggle = (k: keyof typeof open) =>
    setOpen(prev => ({ ...prev, [k]: !prev[k] }));
  const advance = (from: keyof typeof open, to: keyof typeof open) =>
    setOpen(prev => ({ ...prev, [from]: false, [to]: true }));

  const storeComplete = !!(state.store.merchantName && state.store.personaName && state.store.personaDescription);
  const productsComplete = true;
  const stripeComplete = !!(state.stripe.publishableKey?.startsWith('pk_') && state.stripe.secretKey?.startsWith('sk_'));
  const awsComplete = !!(state.aws.accessKeyId && state.aws.secretAccessKey && state.aws.region && state.aws.stackName);
  const completedCount = [storeComplete, productsComplete, stripeComplete, awsComplete].filter(Boolean).length;
  const canDeploy = storeComplete && stripeComplete && awsComplete;

  const quickPrompts = state.catalog.quickPrompts ?? ['', '', '', ''];

  async function handleDeploy() {
    setDeploying(true); setLogLines([]); setDeployResult(null);
    await fetch('/api/save-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store: state.store, catalog: state.catalog, stripe: state.stripe, aws: state.aws }),
    });
    const res = await fetch('/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stripeSecretKey: state.stripe.secretKey,
        awsAccessKeyId: state.aws.accessKeyId,
        awsSecretAccessKey: state.aws.secretAccessKey,
        awsRegion: state.aws.region,
        stackName: state.aws.stackName,
        merchantName: state.store.merchantName,
        personaName: state.store.personaName,
        personaDescription: state.store.personaDescription,
      }),
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n\n'); buf = parts.pop() ?? '';
      for (const part of parts) {
        const raw = part.replace(/^data: /, '').trim();
        if (!raw) continue;
        try {
          const p = JSON.parse(raw);
          if (p.done) { setDeployResult(p.ok ? 'success' : 'error'); setDeploying(false); }
          else if (p.line !== undefined) {
            const line: string = p.line;
            if (line.startsWith('INFRA_')) {
              const [k, v] = line.split('=');
              setInfra(prev => ({ ...prev, ...(k === 'INFRA_STACK' && { stackName: v }), ...(k === 'INFRA_FRONTEND' && { frontendUrl: v }), ...(k === 'INFRA_API' && { apiEndpoint: v }), ...(k === 'INFRA_BUCKET' && { bucketName: v }), ...(k === 'INFRA_LAMBDA' && { lambdaName: v }) }));
            } else {
              setLogLines(prev => { const next = [...prev, line]; setTimeout(() => logRef.current?.scrollTo({ top: 9999 }), 20); return next; });
            }
          }
        } catch {}
      }
    }
  }

  return (
    <div className="page-bg">
      <div className="page-content">

        {/* Header */}
        <header className="setup-header">
          <span className="setup-header-title">Deploy Onsite Agent with AWS + Stripe</span>
          <span className="setup-badge">Setup</span>
        </header>

        {/* Sections */}
        <div className="sections-stack">

          <Section icon={Store} title="Store" complete={storeComplete} open={open.store}
            summary={storeComplete ? `${state.store.merchantName} · ${state.store.personaName}` : undefined}
            onToggle={() => toggle('store')}>
            <Field label="Store name" placeholder="e.g. Acme Shop" value={state.store.merchantName ?? ''} onChange={v => upd('store', { merchantName: v })} />
            <Field label="AI persona name" placeholder="e.g. Alex" value={state.store.personaName ?? ''} onChange={v => upd('store', { personaName: v })} />
            <Field label="Persona description" placeholder="e.g. Your personal shopping assistant" value={state.store.personaDescription ?? ''} onChange={v => upd('store', { personaDescription: v })} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="continue-btn" disabled={!storeComplete} onClick={() => advance('store', 'products')}>Continue →</button>
            </div>
          </Section>

          <Section icon={Package} title="Products" complete={productsComplete} open={open.products}
            summary={`${state.catalog.products?.length || 0} products · ${quickPrompts.filter(Boolean).length} prompts`}
            onToggle={() => toggle('products')}>
            <div>
              <span className="section-sub-label">Quick prompts</span>
              <div className="prompts-list">
                {[0,1,2,3].map(i => (
                  <input key={i} type="text" className="field-input" placeholder={`Prompt ${i + 1}`}
                    value={quickPrompts[i] ?? ''}
                    onChange={e => { const next = [...quickPrompts]; next[i] = e.target.value; upd('catalog', { quickPrompts: next }); }}
                  />
                ))}
              </div>
            </div>
            <div>
              <span className="section-sub-label">Catalog</span>
              <div className="products-list">
                {(state.catalog.products ?? []).map(p => (
                  <div key={p.id} className="product-row">
                    <span className="product-row-name">{p.name}</span>
                    <span className="product-row-price">${p.price.toFixed(2)}</span>
                    {p.category && <span className="product-row-cat">{p.category}</span>}
                    <button type="button" className="product-remove-btn"
                      onClick={() => upd('catalog', { products: state.catalog.products!.filter(x => x.id !== p.id) })}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <ProductForm onAdd={p => upd('catalog', { products: [...(state.catalog.products ?? []), p] })} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="continue-btn" onClick={() => advance('products', 'stripe')}>Continue →</button>
            </div>
          </Section>

          <Section icon={CreditCard} title="Stripe" complete={stripeComplete} open={open.stripe}
            summary={stripeComplete ? `${state.stripe.publishableKey!.slice(0, 14)}…` : undefined}
            onToggle={() => toggle('stripe')}>
            <Field label="Publishable key" placeholder="pk_live_…" value={state.stripe.publishableKey ?? ''} onChange={v => upd('stripe', { publishableKey: v })} hint="Starts with pk_test_ or pk_live_" />
            <Field label="Secret key" type="password" placeholder="sk_live_…" value={state.stripe.secretKey ?? ''} onChange={v => upd('stripe', { secretKey: v })} hint="Stored in AWS SSM — never in code" />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="continue-btn" disabled={!stripeComplete} onClick={() => advance('stripe', 'aws')}>Continue →</button>
            </div>
          </Section>

          <Section icon={Cloud} title="AWS" complete={awsComplete} open={open.aws}
            summary={awsComplete ? `${state.aws.region} · ${state.aws.stackName}` : undefined}
            onToggle={() => toggle('aws')}>
            <div className="field-group">
              <label className="field-label">Region</label>
              <select className="field-input" value={state.aws.region ?? 'us-east-1'} onChange={e => upd('aws', { region: e.target.value })}>
                {AWS_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <Field label="Stack name" placeholder="onsite-agent" value={state.aws.stackName ?? ''} onChange={v => upd('aws', { stackName: v })} />
            <Field label="Access key ID" placeholder="AKIA…" value={state.aws.accessKeyId ?? ''} onChange={v => upd('aws', { accessKeyId: v })} />
            <Field label="Secret access key" type="password" placeholder="…" value={state.aws.secretAccessKey ?? ''} onChange={v => upd('aws', { secretAccessKey: v })} />
          </Section>

        </div>

        {/* Footer */}
        <div className="setup-footer">
          <p className="progress-text">{completedCount} of 4 sections complete</p>
          <button type="button" className="deploy-btn" onClick={handleDeploy} disabled={!canDeploy || deploying}>
            {deploying ? 'Deploying…' : 'Deploy to AWS →'}
          </button>

          <AnimatePresence>
            {(deploying || logLines.length > 0) && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                <div className="terminal-log-wrap">
                  <button type="button" className="log-copy-btn" title="Copy log"
                    onClick={() => navigator.clipboard.writeText(logLines.map(stripAnsi).join('\n'))}>
                    <Copy size={12} />
                  </button>
                  <div ref={logRef} className="terminal-log">
                    {logLines.map((line, i) => {
                      const clean = stripAnsi(line);
                      return (
                        <span key={i} className={`log-line${clean.startsWith('✅') ? ' log-success' : clean.startsWith('❌') ? ' log-error' : ''}`}>
                          {clean || ' '}{'\n'}
                        </span>
                      );
                    })}
                    {deploying && <span className="log-cursor">▋</span>}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {deployResult === 'success' && (
            <>
              <div className="status-callout success">
                <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <div><strong>Deployment complete!</strong><br /><span style={{ fontSize: 12, opacity: 0.8 }}>Your store is live.</span></div>
              </div>
              {infra && (
                <div className="infra-summary">
                  <p className="infra-title">AWS Resources Created</p>
                  <div className="infra-grid">
                    {infra.frontendUrl && <InfraRow label="Frontend URL" value={infra.frontendUrl} link={infra.frontendUrl} />}
                    {infra.stackName && <InfraRow label="CloudFormation Stack" value={infra.stackName} link={`https://console.aws.amazon.com/cloudformation/home#/stacks`} />}
                    {infra.lambdaName && <InfraRow label="Lambda Function" value={infra.lambdaName} link={`https://console.aws.amazon.com/lambda/home#/functions/${infra.lambdaName}`} />}
                    {infra.bucketName && <InfraRow label="S3 Bucket" value={infra.bucketName} link={`https://s3.console.aws.amazon.com/s3/buckets/${infra.bucketName}`} />}
                    {infra.apiEndpoint && <InfraRow label="API Endpoint" value={infra.apiEndpoint} />}
                  </div>
                </div>
              )}
            </>
          )}
          {deployResult === 'error' && (
            <div className="status-callout error">
              <XCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div><strong>Deployment failed</strong><br /><span style={{ fontSize: 12, opacity: 0.8 }}>Check the log above and try again.</span></div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
