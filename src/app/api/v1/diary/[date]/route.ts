import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDiaryDay } from '@/lib/diary-service';
import { validIsoDate } from '@/lib/nutrition-calculator';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ date: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { date } = await params;
  if (!validIsoDate(date)) return NextResponse.json({ error: 'date must be YYYY-MM-DD.' }, { status: 400 });
  try {
    return NextResponse.json(await getDiaryDay(session.user.id, date), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load diary data.' }, { status: 500 });
  }
}
