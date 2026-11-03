import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { recalcDiaryTotals } from '@/lib/db/helpers';
import { scaleNutrients } from '@/lib/nutrition-calculator';
import { and, eq } from 'drizzle-orm';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  const foodEntryId = body.foodEntryId;
  const quantity = body.quantity;
  if (typeof foodEntryId !== 'string' || !foodEntryId.trim() || typeof quantity !== 'number'
      || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) {
    return NextResponse.json({ error: 'A food entry and valid positive quantity are required.' }, { status: 400 });
  }

  try {
    const row = await db.select({
      diaryEntryId: schema.foodEntries.diaryEntryId, oldQuantity: schema.foodEntries.quantity,
      oldEnergy: schema.foodEntries.energyKcal, oldProtein: schema.foodEntries.proteinG,
      oldCarbs: schema.foodEntries.carbsG, oldFat: schema.foodEntries.fatG,
      oldFiber: schema.foodEntries.fiberG, oldSodium: schema.foodEntries.sodiumMg,
      oldSugar: schema.foodEntries.sugarG, oldNutrients: schema.foodEntries.nutrientValues,
      oldSource: schema.foodEntries.nutrientSource,
      baseFood: {
        energyKcal: schema.foods.energyKcal, proteinG: schema.foods.proteinG,
        carbsG: schema.foods.carbohydrateG, fatG: schema.foods.totalFatG,
        fiberG: schema.foods.dietaryFiberG, sodiumMg: schema.foods.sodiumMg,
        sugarG: schema.foods.totalSugarsG, nutrientValues: schema.foods.nutrientValues,
        nutrientSource: schema.foods.nutrientSource,
      },
    }).from(schema.foodEntries)
      .innerJoin(schema.diaryEntries, eq(schema.foodEntries.diaryEntryId, schema.diaryEntries.id))
      .leftJoin(schema.foods, eq(schema.foodEntries.foodId, schema.foods.id))
      .where(and(eq(schema.foodEntries.id, foodEntryId), eq(schema.diaryEntries.userId, session.user.id))).get();
    if (!row) return NextResponse.json({ error: 'Food entry not found.' }, { status: 404 });

    const ratio = row.oldQuantity > 0 ? quantity / row.oldQuantity : quantity;
    const linkedFood = row.baseFood && row.baseFood.nutrientSource !== undefined;
    const base = linkedFood ? row.baseFood : {
      energyKcal: row.oldEnergy === null ? null : row.oldEnergy / row.oldQuantity,
      proteinG: row.oldProtein === null ? null : row.oldProtein / row.oldQuantity,
      carbsG: row.oldCarbs === null ? null : row.oldCarbs / row.oldQuantity,
      fatG: row.oldFat === null ? null : row.oldFat / row.oldQuantity,
      fiberG: row.oldFiber === null ? null : row.oldFiber / row.oldQuantity,
      sodiumMg: row.oldSodium === null ? null : row.oldSodium / row.oldQuantity,
      sugarG: row.oldSugar === null ? null : row.oldSugar / row.oldQuantity,
    };
    const factor = linkedFood ? quantity : ratio;
    const scaled = scaleNutrients({
      energyKcal: base.energyKcal, proteinG: base.proteinG, carbsG: base.carbsG,
      fatG: base.fatG, fiberG: base.fiberG, sodiumMg: base.sodiumMg, sugarG: base.sugarG,
    }, factor);
    const sourceMap = linkedFood ? row.baseFood.nutrientValues : row.oldNutrients;
    const nutrientValues = sourceMap ? scaleNutrients(sourceMap as Record<string, number | null>, factor) : null;

    await db.update(schema.foodEntries).set({
      quantity, energyKcal: scaled.energyKcal, proteinG: scaled.proteinG,
      carbsG: scaled.carbsG, fatG: scaled.fatG, fiberG: scaled.fiberG,
      sodiumMg: scaled.sodiumMg, sugarG: scaled.sugarG, nutrientValues,
      nutrientSource: (linkedFood ? row.baseFood.nutrientSource : null) || row.oldSource || null,
    }).where(eq(schema.foodEntries.id, foodEntryId)).run();
    await recalcDiaryTotals(row.diaryEntryId);
    return NextResponse.json({ success: true, quantity });
  } catch {
    return NextResponse.json({ error: 'Could not update this food entry.' }, { status: 500 });
  }
}
