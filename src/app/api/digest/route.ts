import { NextResponse } from 'next/server';
import { getLatestDigest, getAllTopics } from '@/lib/db/queries';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const topicId = searchParams.get('topicId');

  if (topicId) {
    const digest = getLatestDigest(topicId);
    return NextResponse.json(digest);
  }

  // Return latest digest across all topics
  const topics = getAllTopics();
  const digests = topics
    .map(t => getLatestDigest(t.id))
    .filter(Boolean)
    .sort((a, b) => b!.digest_date.localeCompare(a!.digest_date));

  return NextResponse.json(digests[0] || null);
}
