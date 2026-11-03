import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { validIsoDate } from '@/lib/nutrition-calculator';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  const updates: { content?: string; entryDate?: string; entryTime?: string } = {};
  if (body.content !== undefined) {
    if (typeof body.content !== 'string' || !body.content.trim() || body.content.length > 10000) {
      return NextResponse.json({ error: 'Journal content must be 1–10,000 characters.' }, { status: 400 });
    }
    updates.content = body.content.trim();
  }
  if (body.entry_date !== undefined) {
    if (typeof body.entry_date !== 'string' || !validIsoDate(body.entry_date)) return NextResponse.json({ error: 'entry_date must be YYYY-MM-DD.' }, { status: 400 });
    updates.entryDate = body.entry_date;
  }
  if (body.entry_time !== undefined) {
    if (typeof body.entry_time !== 'string' || !/^[0-2][0-9]:[0-5][0-9]$/.test(body.entry_time)) return NextResponse.json({ error: 'entry_time must use HH:MM.' }, { status: 400 });
    updates.entryTime = body.entry_time;
  }
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });

  try {
    const entry = await db.update(schema.journalEntries).set(updates).where(and(
      eq(schema.journalEntries.id, id),
      eq(schema.journalEntries.userId, session.user.id),
      isNull(schema.journalEntries.deletedAt),
    )).returning({
      id: schema.journalEntries.id,
      entry_date: schema.journalEntries.entryDate,
      entry_time: schema.journalEntries.entryTime,
      content: schema.journalEntries.content,
      date_created: schema.journalEntries.createdAt,
    }).get();
    if (!entry) return NextResponse.json({ error: 'Journal entry not found.' }, { status: 404 });
    return NextResponse.json({ entry });
  } catch {
    return NextResponse.json({ error: 'Could not update journal entry.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    const result = await db.update(schema.journalEntries).set({ deletedAt: new Date().toISOString() })
      .where(and(
        eq(schema.journalEntries.id, id),
        eq(schema.journalEntries.userId, session.user.id),
        isNull(schema.journalEntries.deletedAt),
      )).returning({ id: schema.journalEntries.id }).get();
    if (!result) return NextResponse.json({ error: 'Journal entry not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Could not delete journal entry.' }, { status: 500 });
  }
}
