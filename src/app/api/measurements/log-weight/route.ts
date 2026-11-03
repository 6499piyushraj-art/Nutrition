import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { validIsoDate } from '@/lib/nutrition-calculator';

function adultVerified(dateOfBirth?: string | null): boolean {
  if (!dateOfBirth || !validIsoDate(dateOfBirth)) return false;
  const birth = new Date(dateOfBirth + 'T00:00:00');
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age >= 18 && age < 120;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const profile = await db.select({
      id: schema.healthProfiles.id,
      dateOfBirth: schema.healthProfiles.dateOfBirth,
    }).from(schema.healthProfiles).where(eq(schema.healthProfiles.userId, session.user.id)).get();
    if (!adultVerified(profile?.dateOfBirth)) {
      return NextResponse.json({ error: 'Weight tracking is not enabled for accounts without a verified adult age.' }, { status: 403 });
    }

    const body = await request.json() as { weight?: unknown; date?: unknown };
    const weight = body.weight;
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0 || weight > 1000) {
      return NextResponse.json({ error: 'Enter a valid measurement.' }, { status: 400 });
    }

    const now = new Date();
    const serverToday = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    const date = typeof body.date === 'string' ? body.date : serverToday;
    if (!validIsoDate(date) || date > serverToday) {
      return NextResponse.json({ error: 'Use a valid date that is not in the future.' }, { status: 400 });
    }

    await db.insert(schema.measurements).values({
      userId: session.user.id, date, type: 'weight', value: weight, unit: 'lbs',
    }).run();

    if (profile?.id) {
      await db.update(schema.healthProfiles).set({ currentWeightLbs: weight })
        .where(eq(schema.healthProfiles.id, profile.id)).run();
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Could not save this measurement.' }, { status: 500 });
  }
}
