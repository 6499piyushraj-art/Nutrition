import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { recalcDiaryTotals } from '@/lib/db/helpers';
import { validIsoDate } from '@/lib/nutrition-calculator';
import { and, eq } from 'drizzle-orm';

function numericRecord(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) if (typeof item === 'number' && Number.isFinite(item) && item >= 0) result[key] = item;
  return Object.keys(result).length ? result : null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  const date = body.date;
  const meal = typeof body.meal === 'string' && body.meal.trim() ? body.meal.trim() : 'Food Log';
  const food = body.food;
  const quantity = Number(body.quantity ?? 1);
  if (typeof date !== 'string' || !validIsoDate(date) || !food || typeof food !== 'object' || Array.isArray(food)
      || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) {
    return NextResponse.json({ error: 'A valid date, food description and positive quantity are required.' }, { status: 400 });
  }
  const foodData = food as Record<string, unknown>;

  try {
    const baseNutrients = numericRecord(foodData.nutrient_values);
    const source = typeof foodData.nutrient_source === 'string' ? foodData.nutrient_source
      : foodData.source === 'ai-log' ? 'Gemini estimate'
      : foodData.source === 'usda_fdc' ? 'USDA FoodData Central' : 'User-entered/manual';

    let foodId: string | null = typeof foodData.food_id === 'string' ? foodData.food_id : null;
    if (foodId) {
      const owned = await db.select({ id: schema.foods.id }).from(schema.foods)
        .where(and(eq(schema.foods.id, foodId), eq(schema.foods.userId, session.user.id))).get();
      if (!owned) return NextResponse.json({ error: 'Food not found.' }, { status: 404 });
    }

    if (!foodId && typeof foodData.description === 'string' && foodData.description.trim()) {
      const description = foodData.description.trim();
      const oldFood = await db.select({ id: schema.foods.id }).from(schema.foods)
        .where(and(eq(schema.foods.userId, session.user.id), eq(schema.foods.description, description))).get();
      if (oldFood) foodId = oldFood.id;
      else {
        const created = await db.insert(schema.foods).values({
          userId: session.user.id, description, source: foodData.source === 'ai-log' ? 'ai-log' : 'manual',
          defaultServingSize: typeof foodData.serving_size === 'number' ? foodData.serving_size : 1,
          defaultServingUnit: typeof foodData.serving_unit === 'string' ? foodData.serving_unit : 'serving',
          energyKcal: typeof foodData.calories === 'number' ? foodData.calories : null,
          proteinG: typeof foodData.protein_g === 'number' ? foodData.protein_g : null,
          totalFatG: typeof foodData.fat_g === 'number' ? foodData.fat_g : null,
          carbohydrateG: typeof foodData.carbs_g === 'number' ? foodData.carbs_g : null,
          dietaryFiberG: typeof foodData.fiber_g === 'number' ? foodData.fiber_g : null,
          totalSugarsG: typeof foodData.sugar_g === 'number' ? foodData.sugar_g : null,
          sodiumMg: typeof foodData.sodium_mg === 'number' ? foodData.sodium_mg : null,
          saturatedFatG: typeof foodData.saturated_fat_g === 'number' ? foodData.saturated_fat_g : null,
          cholesterolMg: typeof foodData.cholesterol_mg === 'number' ? foodData.cholesterol_mg : null,
          nutrientValues: baseNutrients, nutrientSource: source,
        }).returning({ id: schema.foods.id }).get();
        foodId = created.id;
      }
    }

    const mealEntry = await db.select().from(schema.diaryEntries).where(and(
      eq(schema.diaryEntries.date, date), eq(schema.diaryEntries.diaryMeal, meal),
      eq(schema.diaryEntries.type, 'diary_meal'), eq(schema.diaryEntries.userId, session.user.id),
    )).get();
    let diaryEntryId: string;
    if (mealEntry) diaryEntryId = mealEntry.id;
    else {
      const created = await db.insert(schema.diaryEntries).values({
        date, type: 'diary_meal', diaryMeal: meal, userId: session.user.id,
        totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatG: 0,
        totalFiberG: 0, totalSodiumMg: 0, totalSugarG: 0,
      }).returning().get();
      diaryEntryId = created.id;
    }

    const scale = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value)
      ? Math.round(value * quantity * 10) / 10 : null;
    const nutrientValues = baseNutrients ? Object.fromEntries(Object.entries(baseNutrients).map(([key, value]) => [
      key, Math.round(value * quantity * 1000) / 1000,
    ])) : null;
    await db.insert(schema.foodEntries).values({
      diaryEntryId, foodId, quantity, energyKcal: scale(foodData.calories),
      proteinG: scale(foodData.protein_g), carbsG: scale(foodData.carbs_g),
      fatG: scale(foodData.fat_g), fiberG: scale(foodData.fiber_g),
      sodiumMg: scale(foodData.sodium_mg), sugarG: scale(foodData.sugar_g),
      nutrientValues, nutrientSource: source,
    }).run();
    await recalcDiaryTotals(diaryEntryId);
    return NextResponse.json({ success: true, diary_entry: diaryEntryId });
  } catch {
    return NextResponse.json({ error: 'Could not save this food entry.' }, { status: 500 });
  }
}
