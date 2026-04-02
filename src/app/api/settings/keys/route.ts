import { NextResponse } from 'next/server';
import { getAllApiKeys, upsertApiKey, deleteApiKey } from '@/lib/db/queries';

export async function GET() {
  const keys = getAllApiKeys();
  // Mask keys for display - show first 8 and last 4 chars
  const masked = keys.map(k => ({
    ...k,
    api_key: maskKey(k.api_key),
    api_secret: k.api_secret ? maskKey(k.api_secret) : null,
  }));
  return NextResponse.json(masked);
}

export async function POST(req: Request) {
  const { service, api_key, api_secret } = await req.json();
  if (!service || !api_key) {
    return NextResponse.json({ error: 'service and api_key required' }, { status: 400 });
  }
  upsertApiKey(service, api_key, api_secret);
  return NextResponse.json({ ok: true, service });
}

export async function DELETE(req: Request) {
  const { service } = await req.json();
  if (!service) {
    return NextResponse.json({ error: 'service required' }, { status: 400 });
  }
  deleteApiKey(service);
  return NextResponse.json({ ok: true });
}

function maskKey(key: string): string {
  if (key.length <= 12) return '••••••••';
  return key.substring(0, 8) + '••••' + key.substring(key.length - 4);
}
