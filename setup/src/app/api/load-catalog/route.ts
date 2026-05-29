import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(process.cwd(), '..');

export async function GET() {
  try {
    const raw = readFileSync(resolve(ROOT, 'mcp-server/catalog.json'), 'utf-8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ quickPrompts: [], products: [], storeDescription: '', currency: 'usd' });
  }
}
