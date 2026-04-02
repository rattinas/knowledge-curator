import { NextResponse } from 'next/server';
import { getDigestById } from '@/lib/db/queries';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const digest = getDigestById(id);
  if (!digest) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(digest);
}
