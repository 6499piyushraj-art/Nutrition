import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { recalcDiaryTotals } from '@/lib/db/helpers';
import { eq, and } from 'drizzle-orm';

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
    // The free-text AI logger sends food details without a catalogue ID.
    // Save a matching food record so diary rows can display and edit correctly.
    let foodId: string | null = typeof food.food_id === 'string' ? food.food_id : null;
    if (!foodId && typeof food.description === 'string' && food.description.trim()) {
      const description = food.description.trim();
      const existingFood = db
        .select({ id: schema.foods.id })
        .from(schema.foods)
        .where(and(
          eq(schema.foods.userId, session.user.id),
          eq(schema.foods.description, description),
        ))
        .get();

      if (existingFood) {
        foodId = existingFood.id;
      } else {
        const createdFood = db
          .insert(schema.foods)
          .values({
            userId: session.user.id,
            description,
            source: food.source || 'ai-log',
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
          })
          .returning({ id: schema.foods.id })
          .get();
        foodId = createdFood.id;
      }
    }

    // Find an existing diary entry for this date + log name + user.
    let diaryEntry = db
      .select()
      .from(schema.diaryEntries)
      .where(and(
        eq(schema.diaryEntries.date, date),
        eq(schema.diaryEntries.diaryMeal, meal),
        eq(schema.diaryEntries.type, 'diary_meal'),
        eq(schema.diaryEntries.userId, session.user.id),
      ))
      .get();

    let diaryEntryId: string;
    if (diaryEntry) {
      diaryEntryId = diaryEntry.id;
    } else {
      const result = db
        .insert(schema.diaryEntries)
        .values({
          date,
          type: 'diary_meal',
          diaryMeal: meal,
          userId: session.user.id,
          totalCalories: 0,
          totalProteinG: 0,
          totalCarbsG: 0,
          totalFatG: 0,
          totalFiberG: 0,
          totalSodiumMg: 0,
          totalSugarG: 0,
        })
        .returning()
        .get();
      diaryEntryId = result.id;
    }

    const scale = (value: unknown) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) return null;
      return Math.round(value * quantity * 10) / 10;
    };

    db.insert(schema.foodEntries)
      .values({
        diaryEntryId,
        foodId,
        quantity,
        energyKcal: scale(food.calories),
        proteinG: scale(food.protein_g),
        carbsG: scale(food.carbs_g),
        fatG: scale(food.fat_g),
        fiberG: scale(food.fiber_g),
        sodiumMg: scale(food.sodium_mg),
        sugarG: scale(food.sugar_g),
      })
      .run();

    recalcDiaryTotals(diaryEntryId);
    return NextResponse.json({ success: true, diary_entry: diaryEntryId });
  } catch (err) {
    return NextResponse.json(
      { error: 'Server error: ' + (err instanceof Error ? err.message : 'Unknown') },
      { status: 500 },
    );
  }
}
