import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { and, eq, inArray } from 'drizzle-orm';
import { validIsoDate } from '@/lib/nutrition-calculator';

export const dynamic = 'force-dynamic';

type DebugEntry = { id: string; diaryMeal: string | null; totalCalories: number | null };
type DebugFoodRow = { diaryEntryId: string; id: string; quantity: number; energyKcal: number | null; foodDescription: string | null };

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const date = new URL(request.url).searchParams.get('date');
  if (!date || !validIsoDate(date)) return NextResponse.json({ error: 'A valid date is required.' }, { status: 400 });

  try {
    const entries: DebugEntry[] = await db.select({
      id: schema.diaryEntries.id,
      diaryMeal: schema.diaryEntries.diaryMeal,
      totalCalories: schema.diaryEntries.totalCalories,
    }).from(schema.diaryEntries).where(and(
      eq(schema.diaryEntries.date, date),
      eq(schema.diaryEntries.userId, session.user.id),
      eq(schema.diaryEntries.type, 'diary_meal'),
    )).all();

    const entryIds = entries.map((entry) => entry.id);
    const foodRows: DebugFoodRow[] = entryIds.length ? await db.select({
      diaryEntryId: schema.foodEntries.diaryEntryId,
      id: schema.foodEntries.id,
      quantity: schema.foodEntries.quantity,
      energyKcal: schema.foodEntries.energyKcal,
      foodDescription: schema.foods.description,
    }).from(schema.foodEntries)
      .leftJoin(schema.foods, eq(schema.foodEntries.foodId, schema.foods.id))
      .where(and(
        inArray(schema.foodEntries.diaryEntryId, entryIds),
      )).all() : [];

    return NextResponse.json({
      entryCount: entries.length,
      entries: entries.map((entry) => ({
        id: entry.id,
        diaryMeal: entry.diaryMeal,
        totalCalories: entry.totalCalories,
        foodEntries: foodRows.filter((row) => row.diaryEntryId === entry.id).map((row) => ({
          id: row.id,
          quantity: row.quantity,
          energyKcal: row.energyKcal,
          description: row.foodDescription,
        })),
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load the local debug diary.' }, { status: 500 });
  }
}
