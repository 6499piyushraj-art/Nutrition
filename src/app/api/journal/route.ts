import { NextResponse } from 'next/server';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { validIsoDate } from '@/lib/nutrition-calculator';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const date = new URL(request.url).searchParams.get('date');
  if (!date || !validIsoDate(date)) return NextResponse.json({ error: 'A valid date parameter is required.' }, { status: 400 });
  try {
    const entries = await db.select({
      id: schema.journalEntries.id, entry_date: schema.journalEntries.entryDate,
      entry_time: schema.journalEntries.entryTime, content: schema.journalEntries.content,
      date_created: schema.journalEntries.createdAt,
    }).from(schema.journalEntries).where(and(
      eq(schema.journalEntries.userId, session.user.id),
      eq(schema.journalEntries.entryDate, date),
      isNull(schema.journalEntries.deletedAt),
    )).orderBy(asc(schema.journalEntries.entryTime));
    return NextResponse.json({ entries }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load journal entries.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const date = body.entry_date;
  const time = body.entry_time;
  const content = body.content;
  if (typeof date !== 'string' || !validIsoDate(date)
      || typeof time !== 'string' || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)
      || typeof content !== 'string' || !content.trim() || content.length > 10000) {
    return NextResponse.json({ error: 'Enter a valid date, time and journal entry (up to 10,000 characters).' }, { status: 400 });
  }
  try {
    const entry = await db.insert(schema.journalEntries).values({
      userId: session.user.id, entryDate: date, entryTime: time, content: content.trim(),
    }).returning({
      id: schema.journalEntries.id, entry_date: schema.journalEntries.entryDate,
      entry_time: schema.journalEntries.entryTime, content: schema.journalEntries.content,
      date_created: schema.journalEntries.createdAt,
    }).get();
    return NextResponse.json({ entry });
  } catch {
    return NextResponse.json({ error: 'Could not save journal entry.' }, { status: 500 });
  }
}
