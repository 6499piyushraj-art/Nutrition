import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { NUTRIENT_SPECS } from '@/lib/nutrients';
import { validIsoDate } from '@/lib/nutrition-calculator';

export const dynamic = 'force-dynamic';

type ContributorRow = {
  id: string;
  diaryEntryId: string;
  meal: string | null;
  foodName: string | null;
  quantity: number;
  energyKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sodiumMg: number | null;
  nutrientValues: Record<string, number> | null;
  nutrientSource: string | null;
};

function nutrientValue(row: ContributorRow, key: string): number | null {
  const direct: Record<string, number | null> = {
    calories: row.energyKcal,
    protein: row.proteinG,
    carbs: row.carbsG,
    fat: row.fatG,
    fiber: row.fiberG,
    sodium: row.sodiumMg,
  };
  if (Object.prototype.hasOwnProperty.call(direct, key)) return direct[key];
  const value = row.nutrientValues?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const date = params.get('date') || '';
  const key = params.get('nutrient') || '';
  const nutrient = NUTRIENT_SPECS.find((spec) => spec.key === key);
  if (!validIsoDate(date)) return NextResponse.json({ error: 'date must be a valid YYYY-MM-DD calendar date.' }, { status: 400 });
  if (!nutrient) return NextResponse.json({ error: 'Choose a supported nutrient.' }, { status: 400 });

  try {
    const rows: ContributorRow[] = await db.select({
      id: schema.foodEntries.id,
      diaryEntryId: schema.foodEntries.diaryEntryId,
      meal: schema.diaryEntries.diaryMeal,
      foodName: schema.foods.description,
      quantity: schema.foodEntries.quantity,
      energyKcal: schema.foodEntries.energyKcal,
      proteinG: schema.foodEntries.proteinG,
      carbsG: schema.foodEntries.carbsG,
      fatG: schema.foodEntries.fatG,
      fiberG: schema.foodEntries.fiberG,
      sodiumMg: schema.foodEntries.sodiumMg,
      nutrientValues: schema.foodEntries.nutrientValues,
      nutrientSource: schema.foodEntries.nutrientSource,
    }).from(schema.foodEntries)
      .innerJoin(schema.diaryEntries, eq(schema.foodEntries.diaryEntryId, schema.diaryEntries.id))
      .leftJoin(schema.foods, eq(schema.foodEntries.foodId, schema.foods.id))
      .where(and(
        eq(schema.diaryEntries.userId, session.user.id),
        eq(schema.diaryEntries.date, date),
        eq(schema.diaryEntries.type, 'diary_meal'),
      ))
      .orderBy(asc(schema.diaryEntries.createdAt)).all() as ContributorRow[];

    const contributors = rows.map((row) => ({
      id: row.id,
      meal: row.meal || 'Meal',
      food: row.foodName || 'Saved food',
      value: nutrientValue(row, key),
      source: row.nutrientSource,
      quantity: row.quantity,
    })).sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

    const known = contributors.filter((item) => item.value !== null);
    const missing = contributors.length - known.length;
    const status = !contributors.length ? 'no_food' : missing ? (known.length ? 'partial' : 'unavailable') : 'complete';
    const value = status === 'complete'
      ? Math.round(known.reduce((sum, item) => sum + (item.value ?? 0), 0) * 1000) / 1000
      : null;

    return NextResponse.json({
      date,
      nutrient: { key: nutrient.key, label: nutrient.label, unit: nutrient.unit },
      value,
      status,
      knownFoods: known.length,
      totalFoods: contributors.length,
      contributors,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load nutrient contributors.' }, { status: 500 });
  }
}
