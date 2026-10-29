import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { recalcDiaryTotals } from '@/lib/db/helpers';
import { eq } from 'drizzle-orm';

function scaleNullable(value: number | null, quantity: number): number | null {
  return value === null || value === undefined ? null : Math.round(value * quantity * 10) / 10;
}
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { foodEntryId, diaryEntryId, quantity } = await request.json();
  if (!foodEntryId || typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  try {
    const row = await db.select({
      oldQuantity: schema.foodEntries.quantity,
      oldEnergy: schema.foodEntries.energyKcal,
      oldProtein: schema.foodEntries.proteinG,
      oldCarbs: schema.foodEntries.carbsG,
      oldFat: schema.foodEntries.fatG,
      oldFiber: schema.foodEntries.fiberG,
      oldSodium: schema.foodEntries.sodiumMg,
      oldSugar: schema.foodEntries.sugarG,
      oldNutrients: schema.foodEntries.nutrientValues,
      oldSource: schema.foodEntries.nutrientSource,
      baseFood: {
        energyKcal: schema.foods.energyKcal,
        proteinG: schema.foods.proteinG,
        carbsG: schema.foods.carbohydrateG,
        fatG: schema.foods.totalFatG,
        fiberG: schema.foods.dietaryFiberG,
        sugarG: schema.foods.totalSugarsG,
        sodiumMg: schema.foods.sodiumMg,
        nutrientValues: schema.foods.nutrientValues,
        nutrientSource: schema.foods.nutrientSource,
      },
    }).from(schema.foodEntries)
      .leftJoin(schema.foods, eq(schema.foodEntries.foodId, schema.foods.id))
      .where(eq(schema.foodEntries.id, foodEntryId)).get();
    if (!row) return NextResponse.json({ error: 'Food entry not found' }, { status: 404 });

    const factor = row.oldQuantity > 0 ? quantity / row.oldQuantity : quantity;
    const base = row.baseFood;
    const fallback = (value: number | null) => value === null || value === undefined ? null : Math.round(value * factor * 10) / 10;
    const nutrients = base ? {
      energyKcal: scaleNullable(base.energyKcal, quantity),
      proteinG: scaleNullable(base.proteinG, quantity),
      carbsG: scaleNullable(base.carbsG, quantity),
      fatG: scaleNullable(base.fatG, quantity),
      fiberG: scaleNullable(base.fiberG, quantity),
      sodiumMg: scaleNullable(base.sodiumMg, quantity),
      sugarG: fallback(row.oldSugar),
    } : {
      energyKcal: fallback(row.oldEnergy), proteinG: fallback(row.oldProtein), carbsG: fallback(row.oldCarbs),
      fatG: fallback(row.oldFat), fiberG: fallback(row.oldFiber), sodiumMg: fallback(row.oldSodium), sugarG: fallback(row.oldSugar),
    };
    const baseValues = base?.nutrientValues || row.oldNutrients;
    const nutrientValues = baseValues
      ? Object.fromEntries(Object.entries(baseValues).map(([key, value]) => [
          key, Math.round(value * (base?.nutrientValues ? quantity : factor) * 1000) / 1000,
        ]))
      : null;
    await db.update(schema.foodEntries).set({
      quantity, ...nutrients, nutrientValues, nutrientSource: base?.nutrientSource || row.oldSource || null,
    }).where(eq(schema.foodEntries.id, foodEntryId)).run();
    if (diaryEntryId) recalcDiaryTotals(diaryEntryId);
    return NextResponse.json({ success: true, quantity });
  } catch (err) {
    return NextResponse.json({ error: 'Server error: ' + (err instanceof Error ? err.message : 'Unknown') }, { status: 500 });
  }
}
