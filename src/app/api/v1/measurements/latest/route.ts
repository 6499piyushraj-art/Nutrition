import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const rows = await db.select({
      id: schema.measurements.id, date: schema.measurements.date,
      type: schema.measurements.type, value: schema.measurements.value,
      unit: schema.measurements.unit, notes: schema.measurements.notes,
    }).from(schema.measurements)
      .where(eq(schema.measurements.userId, session.user.id))
      .orderBy(desc(schema.measurements.date)).all();
    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows) if (!latest.has(row.type)) latest.set(row.type, row);
    return NextResponse.json({ measurements: [...latest.values()] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load latest measurements.' }, { status: 500 });
  }
}
