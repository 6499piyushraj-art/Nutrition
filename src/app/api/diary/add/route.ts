import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { recalcDiaryTotals } from '@/lib/db/helpers';
import { eq, and } from 'drizzle-orm';

function numericRecord(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'number' && Number.isFinite(item)) result[key] = item;
  }
  return Object.keys(result).length ? result : null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const date = body.date;
  const meal = typeof body.meal === 'string' && body.meal.trim() ? body.meal.trim() : 'Food Log';
  const food = body.food;
  const quantity = Number(body.quantity ?? 1);
  if (!date || !food || !Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: 'A date, food description and valid quantity are required' }, { status: 400 });
  }

  try {
    const baseNutrients = numericRecord(food.nutrient_values);
    const source = typeof food.nutrient_source === 'string' ? food.nutrient_source
      : food.source === 'ai-log' ? 'Gemini estimate'
      : food.source === 'usda_fdc' ? 'USDA FoodData Central'
      : 'User-entered/manual';

    let foodId: string | null = typeof food.food_id === 'string' ? food.food_id : null;
    if (!foodId && typeof food.description === 'string' && food.description.trim()) {
      const description = food.description.trim();
      const oldFood = db.select({ id: schema.foods.id }).from(schema.foods)
        .where(and(eq(schema.foods.userId, session.user.id), eq(schema.foods.description, description))).get();
      if (oldFood) {
        foodId = oldFood.id;
      } else {
        const created = db.insert(schema.foods).values({
          userId: session.user.id,
          description,
          source: food.source || 'manual',
          defaultServingSize: typeof food.serving_size === 'number' ? food.serving_size : 1,
          defaultServingUnit: typeof food.serving_unit === 'string' ? food.serving_unit : 'log',
          energyKcal: typeof food.calories === 'number' ? food.calories : null,
          proteinG: typeof food.protein_g === 'number' ? food.protein_g : null,
          totalFatG: typeof food.fat_g === 'number' ? food.fat_g : null,
          carbohydrateG: typeof food.carbs_g === 'number' ? food.carbs_g : null,
          dietaryFiberG: typeof food.fiber_g === 'number' ? food.fiber_g : null,
          totalSugarsG: typeof food.sugar_g === 'number' ? food.sugar_g : null,
          sodiumMg: typeof food.sodium_mg === 'number' ? food.sodium_mg : null,
          saturatedFatG: typeof food.saturated_fat_g === 'number' ? food.saturated_fat_g : null,
          cholesterolMg: typeof food.cholesterol_mg === 'number' ? food.cholesterol_mg : null,
          nutrientValues: baseNutrients,
          nutrientSource: source,
        }).returning({ id: schema.foods.id }).get();
        foodId = created.id;
      }
    }

    let diary = db.select().from(schema.diaryEntries).where(and(
      eq(schema.diaryEntries.date, date),
      eq(schema.diaryEntries.diaryMeal, meal),
      eq(schema.diaryEntries.type, 'diary_meal'),
      eq(schema.diaryEntries.userId, session.user.id),
    )).get();

    let diaryEntryId: string;
    if (diary) diaryEntryId = diary.id;
    else {
      const createdDiary = db.insert(schema.diaryEntries).values({
        date, type: 'diary_meal', diaryMeal: meal, userId: session.user.id,
        totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatG: 0,
        totalFiberG: 0, totalSodiumMg: 0, totalSugarG: 0,
      }).returning().get();
      diaryEntryId = createdDiary.id;
    }

    const scale = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value)
      ? Math.round(value * quantity * 10) / 10 : null;
    const nutrientsForEntry = baseNutrients
      ? Object.fromEntries(Object.entries(baseNutrients).map(([key, value]) => [key, Math.round(value * quantity * 1000) / 1000]))
      : null;
    db.insert(schema.foodEntries).values({
      diaryEntryId, foodId, quantity,
      energyKcal: scale(food.calories), proteinG: scale(food.protein_g), carbsG: scale(food.carbs_g),
      fatG: scale(food.fat_g), fiberG: scale(food.fiber_g), sodiumMg: scale(food.sodium_mg),
      sugarG: scale(food.sugar_g), nutrientValues: nutrientsForEntry, nutrientSource: source,
    }).run();
    recalcDiaryTotals(diaryEntryId);
    return NextResponse.json({ success: true, diary_entry: diaryEntryId });
  } catch (err) {
    return NextResponse.json({ error: 'Server error: ' + (err instanceof Error ? err.message : 'Unknown') }, { status: 500 });
  }
}
