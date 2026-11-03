import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { isUnder18OrUnknown, validIsoDate } from '@/lib/nutrition-calculator';

export async function GET(_request: Request, { params }: { params: Promise<{ date: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { date } = await params;
  if (!validIsoDate(date)) return NextResponse.json({ error: 'date must be YYYY-MM-DD.' }, { status: 400 });

  try {
    const profile = await db.select({ dateOfBirth: schema.healthProfiles.dateOfBirth })
      .from(schema.healthProfiles).where(eq(schema.healthProfiles.userId, session.user.id)).get();
    const isMinor = isUnder18OrUnknown(profile?.dateOfBirth);
    // Fetch diary entries for the given date, user, and type
    const entries: Array<typeof schema.diaryEntries.$inferSelect> = await db
      .select()
      .from(schema.diaryEntries)
      .where(
        and(
          eq(schema.diaryEntries.date, date),
          eq(schema.diaryEntries.userId, session.user.id),
          eq(schema.diaryEntries.type, 'diary_meal'),
        ),
      )
      .all();

    // For each entry, fetch food entries with linked food data
    const result = await Promise.all(entries.map(async (entry) => {
      const foodEntriesData: Array<{
        id: string; quantity: number; energy_kcal: number | null; protein_g: number | null;
        carbs_g: number | null; fat_g: number | null; fiber_g: number | null;
        sodium_mg: number | null; sugar_g: number | null;
        food: { id: string | null; description: string | null; brand_name: string | null;
          energy_kcal: number | null; protein_g: number | null; carbs_g: number | null;
          fat_g: number | null; fiber_g: number | null; sodium_mg: number | null; sugar_g: number | null;
          default_serving_size: number | null; default_serving_unit: string | null } | null;
      }> = await db
        .select({
          id: schema.foodEntries.id,
          quantity: schema.foodEntries.quantity,
          energy_kcal: schema.foodEntries.energyKcal,
          protein_g: schema.foodEntries.proteinG,
          carbs_g: schema.foodEntries.carbsG,
          fat_g: schema.foodEntries.fatG,
          fiber_g: schema.foodEntries.fiberG,
          sodium_mg: schema.foodEntries.sodiumMg,
          sugar_g: schema.foodEntries.sugarG,
          food: {
            id: schema.foods.id,
            description: schema.foods.description,
            brand_name: schema.foods.brandName,
            energy_kcal: schema.foods.energyKcal,
            protein_g: schema.foods.proteinG,
            carbs_g: schema.foods.carbohydrateG,
            fat_g: schema.foods.totalFatG,
            fiber_g: schema.foods.dietaryFiberG,
            sodium_mg: schema.foods.sodiumMg,
            sugar_g: schema.foods.totalSugarsG,
            default_serving_size: schema.foods.defaultServingSize,
            default_serving_unit: schema.foods.defaultServingUnit,
          },
        })
        .from(schema.foodEntries)
        .leftJoin(schema.foods, eq(schema.foodEntries.foodId, schema.foods.id))
        .where(eq(schema.foodEntries.diaryEntryId, entry.id))
        .all();

      return {
        id: entry.id,
        diary_meal: entry.diaryMeal,
        total_calories: entry.totalCalories,
        total_protein_g: entry.totalProteinG,
        total_carbs_g: entry.totalCarbsG,
        total_fat_g: entry.totalFatG,
        food_entries: foodEntriesData.map((fe) => ({
          id: fe.id,
          quantity: fe.quantity,
          energy_kcal: fe.energy_kcal,
          protein_g: fe.protein_g,
          carbs_g: fe.carbs_g,
          fat_g: fe.fat_g,
          fiber_g: fe.fiber_g,
          sodium_mg: fe.sodium_mg,
          sugar_g: fe.sugar_g,
          food: fe.food
            ? {
                id: fe.food.id,
                description: fe.food.description,
                brand_name: fe.food.brand_name,
                energy_kcal: fe.food.energy_kcal,
                protein_g: fe.food.protein_g,
                carbs_g: fe.food.carbs_g,
                fat_g: fe.food.fat_g,
                fiber_g: fe.food.fiber_g,
                sodium_mg: fe.food.sodium_mg,
                sugar_g: fe.food.sugar_g,
                default_serving_size: fe.food.default_serving_size,
                default_serving_unit: fe.food.default_serving_unit,
              }
            : null,
        })),
      };
    }));

    const response = NextResponse.json({ entries: result, isMinor });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 },
    );
  }
}
