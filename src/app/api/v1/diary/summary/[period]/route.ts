import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDiaryRange } from '@/lib/diary-service';
import { validIsoDate } from '@/lib/nutrition-calculator';

const PERIODS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ period: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { period } = await params;
  const span = PERIODS[period];
  if (!span) return NextResponse.json({ error: 'Supported periods are 7d, 30d, and 90d.' }, { status: 400 });
  const now = new Date();
  const requested = new URL(request.url).searchParams.get('endDate');
  const endDate = requested || [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
  if (!validIsoDate(endDate)) return NextResponse.json({ error: 'endDate must be YYYY-MM-DD.' }, { status: 400 });
  const start = new Date(endDate + 'T00:00:00.000Z');
  start.setUTCDate(start.getUTCDate() - span + 1);
  const from = start.toISOString().slice(0,10);
  try {
    return NextResponse.json({ period, ...(await getDiaryRange(session.user.id, from, endDate)) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not calculate diary summary.' }, { status: 500 });
  }
}
