import { NextResponse } from 'next/server';
import { getLatestPipelineRun } from '@/lib/db/queries';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const topicId = searchParams.get('topicId');
  if (!topicId) {
    return NextResponse.json({ error: 'topicId required' }, { status: 400 });
  }

  const run = getLatestPipelineRun(topicId);
  if (!run) {
    return NextResponse.json({ status: 'idle' });
  }

  return NextResponse.json(run);
}
