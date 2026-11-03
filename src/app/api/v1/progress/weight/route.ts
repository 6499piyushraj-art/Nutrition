import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { isVerifiedAdult, validIsoDate } from '@/lib/nutrition-calculator';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const profile = await db.select({ dateOfBirth: schema.healthProfiles.dateOfBirth }).from(schema.healthProfiles).where(eq(schema.healthProfiles.userId, session.user.id)).get();
  if (!isVerifiedAdult(profile?.dateOfBirth)) return NextResponse.json({ error: 'Weight history is not enabled for accounts without a verified adult age.' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from'), to = searchParams.get('to');
  if ((from && !validIsoDate(from)) || (to && !validIsoDate(to))) {
    return NextResponse.json({ error: 'Date filters must use YYYY-MM-DD.' }, { status: 400 });
  }
  try {
    const conditions = [
      eq(schema.measurements.userId, session.user.id),
      eq(schema.measurements.type, 'weight'),
    ];
    if (from) conditions.push(gte(schema.measurements.date, from));
    if (to) conditions.push(lte(schema.measurements.date, to));
    const weights = await db.select({
      id: schema.measurements.id, date: schema.measurements.date,
      value: schema.measurements.value, unit: schema.measurements.unit,
      notes: schema.measurements.notes,
    }).from(schema.measurements).where(and(...conditions))
      .orderBy(asc(schema.measurements.date)).all();
    return NextResponse.json({ weights }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load measurement history.' }, { status: 500 });
  }
}
