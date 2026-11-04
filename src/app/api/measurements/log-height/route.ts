import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { validIsoDate } from '@/lib/nutrition-calculator';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  const heightCm = body.height_cm;
  const now = new Date();
  const today = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
  const date = typeof body.date === 'string' ? body.date : today;

  if (typeof heightCm !== 'number' || !Number.isFinite(heightCm) || heightCm < 50 || heightCm > 260) {
    return NextResponse.json({ error: 'Enter a valid height in centimetres.' }, { status: 400 });
  }
  if (!validIsoDate(date) || date > today) {
    return NextResponse.json({ error: 'Use a valid measurement date that is not in the future.' }, { status: 400 });
  }

  try {
    const record = await db.insert(schema.measurements).values({
      userId: session.user.id,
      date,
      type: 'height',
      value: heightCm,
      unit: 'cm',
    }).returning({
      id: schema.measurements.id,
      date: schema.measurements.date,
      value: schema.measurements.value,
      unit: schema.measurements.unit,
    }).get();
    return NextResponse.json({ success: true, measurement: record });
  } catch {
    return NextResponse.json({ error: 'Could not save this height measurement.' }, { status: 500 });
  }
}
