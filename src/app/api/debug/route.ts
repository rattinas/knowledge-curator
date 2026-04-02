import { NextResponse } from 'next/server';
import { getAllAdapters, getAvailableAdapters } from '@/lib/sources/registry';
import { getAllApiKeys } from '@/lib/db/queries';

export async function GET() {
  const allAdapters = getAllAdapters();
  const available = getAvailableAdapters(['all']);
  const keys = getAllApiKeys();

  return NextResponse.json({
    all_adapters: allAdapters.map(a => ({ name: a.displayName, type: a.sourceType, available: a.isAvailable() })),
    available_adapters: available.map(a => a.displayName),
    db_keys: keys.map(k => ({ service: k.service, has_key: !!k.api_key })),
    env_keys: {
      ANTHROPIC: !!process.env.ANTHROPIC_API_KEY,
      YOUTUBE: !!process.env.YOUTUBE_API_KEY,
      GNEWS: !!process.env.GNEWS_API_KEY,
      PERPLEXITY: !!process.env.PERPLEXITY_API_KEY,
      PODCAST_KEY: !!process.env.PODCAST_INDEX_KEY,
      PODCAST_SECRET: !!process.env.PODCAST_INDEX_SECRET,
    },
  });
}
