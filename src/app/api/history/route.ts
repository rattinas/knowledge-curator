import { NextResponse } from 'next/server';
import { getDigestHistory } from '@/lib/db/queries';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const topicId = searchParams.get('topicId') || undefined;
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  const digests = getDigestHistory(topicId, limit, offset);
  return NextResponse.json(digests);
}
