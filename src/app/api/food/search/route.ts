import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { searchUSDA } from '@/lib/usda';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() || '';
  if (!query) return NextResponse.json({ error: 'Enter a food name to search.' }, { status: 400 });
  if (query.length > 100) return NextResponse.json({ error: 'Food search must be 100 characters or fewer.' }, { status: 400 });

  const requestedLimit = Number.parseInt(searchParams.get('limit') || '10', 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 25)) : 10;
  const rate = checkRateLimit('usda-search:' + session.user.id, 60, 60 * 1000);
  if (!rate.allowed) {
    const retry = Math.ceil(rate.retryAfterMs / 1000);
    return NextResponse.json({ error: 'Too many food searches. Please try again shortly.' }, {
      status: 429, headers: { 'Retry-After': String(retry) },
    });
  }

  try {
    const results = await searchUSDA(query, limit);
    return NextResponse.json(results, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch {
    return NextResponse.json({ error: 'Food composition search is temporarily unavailable. You can still log a custom food.' }, { status: 502 });
  }
}
