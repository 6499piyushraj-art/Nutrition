import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { recalcDiaryTotals } from '@/lib/db/helpers';
import { and, eq } from 'drizzle-orm';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  const foodEntryId = body.foodEntryId;
  if (typeof foodEntryId !== 'string' || !foodEntryId.trim()) {
    return NextResponse.json({ error: 'A food entry is required.' }, { status: 400 });
  }
  try {
    const entry = await db.select({
      id: schema.foodEntries.id, diaryEntryId: schema.foodEntries.diaryEntryId,
    }).from(schema.foodEntries)
      .innerJoin(schema.diaryEntries, eq(schema.foodEntries.diaryEntryId, schema.diaryEntries.id))
      .where(and(eq(schema.foodEntries.id, foodEntryId), eq(schema.diaryEntries.userId, session.user.id))).get();
    if (!entry) return NextResponse.json({ error: 'Food entry not found.' }, { status: 404 });

    await db.delete(schema.foodEntries).where(eq(schema.foodEntries.id, entry.id)).run();
    await recalcDiaryTotals(entry.diaryEntryId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Could not delete this food entry.' }, { status: 500 });
  }
}
