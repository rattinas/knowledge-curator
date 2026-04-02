import { NextResponse } from 'next/server';
import { getAllTopics, createTopic } from '@/lib/db/queries';

export async function GET() {
  const topics = getAllTopics();
  return NextResponse.json(topics);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, keywords, sources, reading_time_min, languages, output_language, recency_days, custom_feeds, crawl_interval_hours } = body;
  if (!name || !keywords?.length) {
    return NextResponse.json({ error: 'name and keywords required' }, { status: 400 });
  }
  const topic = createTopic(name, keywords, sources, reading_time_min || 60, languages || ['all'], output_language || 'de', recency_days || 30, custom_feeds || [], crawl_interval_hours || 24);
  return NextResponse.json(topic, { status: 201 });
}
