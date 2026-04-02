import { NextResponse } from 'next/server';
import { getDigestsGroupedByTopic, getSchedulerStatus } from '@/lib/db/queries';

export async function GET() {
  const grouped = getDigestsGroupedByTopic();
  const status = getSchedulerStatus();
  return NextResponse.json({ grouped, scheduler: status });
}
