import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(process.cwd(), '..');

export async function POST(req: NextRequest) {
  try {
    const { store, catalog, stripe, aws } = await req.json();

    // Write catalog.json — preserve existing products if wizard has none
    const catalogPath = resolve(ROOT, 'mcp-server/catalog.json');
    let existingProducts: any[] = [];
    let existingQuickPrompts: string[] = [];
    let existingStoreDescription = '';
    try {
      const existing = JSON.parse(readFileSync(catalogPath, 'utf-8'));
      existingProducts = existing.products || [];
      existingQuickPrompts = existing.quickPrompts || [];
      existingStoreDescription = existing.storeDescription || '';
    } catch { /* no existing file, start fresh */ }

    const catalogData = {
      storeDescription: catalog.storeDescription || existingStoreDescription,
      currency: catalog.currency || 'usd',
      quickPrompts: catalog.quickPrompts || [],
      products: (catalog.products && catalog.products.length > 0) ? catalog.products : existingProducts,
    };
    writeFileSync(catalogPath, JSON.stringify(catalogData, null, 2));

    // Write samconfig.toml
    const q = (v: string) => `\\"${v.replace(/"/g, '\\\\"')}\\"`;
    const overrides = [
      `MerchantName=${q(store.merchantName || 'My Store')}`,
      `AiPersonaName=${q(store.personaName || 'Alex')}`,
      `AiPersonaDescription=${q(store.personaDescription || 'Your shopping assistant')}`,
      `StripePublishableKey=${q(stripe.publishableKey || '')}`,
      `BedrockModelId=${q('us.anthropic.claude-sonnet-4-6')}`,
    ].join(' ');

    const samconfig = `version = 0.1

[default.deploy.parameters]
stack_name = "${aws.stackName || 'onsite-agent'}"
region = "${aws.region || 'us-east-1'}"
capabilities = "CAPABILITY_IAM"
confirm_changeset = false
resolve_s3 = true
parameter_overrides = "${overrides}"
`;
    writeFileSync(resolve(ROOT, 'infrastructure/samconfig.toml'), samconfig);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
