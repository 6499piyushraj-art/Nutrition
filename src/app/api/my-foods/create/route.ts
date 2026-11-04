import { NextResponse } from 'next/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
function validTagIds(value: unknown): value is string[] {
  return value === undefined || (Array.isArray(value) && value.length <= 100 && value.every((tag) => typeof tag === 'string'));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  if (typeof body.description !== 'string' || !body.description.trim() || body.description.length > 180) {
    return NextResponse.json({ error: 'Food name is required and must be 180 characters or fewer.' }, { status: 400 });
  }
  if (!validTagIds(body.tag_ids)) return NextResponse.json({ error: 'Tag IDs must be a list of at most 100 IDs.' }, { status: 400 });

  const numericFields = ['default_serving_size','energy_kcal','protein_g','fat_g','carbs_g','fiber_g','sugar_g','sodium_mg','saturated_fat_g','cholesterol_mg'] as const;
  for (const field of numericFields) {
    const value = body[field];
    if (value !== null && value !== undefined && value !== '' && optionalNumber(value) === null) {
      return NextResponse.json({ error: `${field} must be a non-negative number.` }, { status: 400 });
    }
  }

  try {
    const tagIds = [...new Set((body.tag_ids || []) as string[])];
    const tags = tagIds.length ? await db.select({ id: schema.foodTags.id }).from(schema.foodTags).where(and(
      eq(schema.foodTags.userId, session.user.id),
      isNull(schema.foodTags.deletedAt),
      inArray(schema.foodTags.id, tagIds),
    )).all() : [];
    if (tags.length !== tagIds.length) return NextResponse.json({ error: 'One or more tags were not found.' }, { status: 404 });

    const foodData = {
      userId: session.user.id,
      description: body.description.trim(),
      brandName: typeof body.brand_name === 'string' ? body.brand_name.slice(0, 160) : null,
      brandOwner: typeof body.brand_owner === 'string' ? body.brand_owner.slice(0, 160) : null,
      upcCode: typeof body.upc_code === 'string' ? body.upc_code.slice(0, 32) : null,
      fdcId: typeof body.fdc_id === 'number' && Number.isInteger(body.fdc_id) ? body.fdc_id : null,
      source: typeof body.source === 'string' ? body.source.slice(0, 80) : 'manual',
      defaultServingSize: optionalNumber(body.default_serving_size),
      defaultServingUnit: typeof body.default_serving_unit === 'string' ? body.default_serving_unit.slice(0, 40) : null,
      energyKcal: optionalNumber(body.energy_kcal),
      proteinG: optionalNumber(body.protein_g),
      totalFatG: optionalNumber(body.fat_g),
      carbohydrateG: optionalNumber(body.carbs_g),
      dietaryFiberG: optionalNumber(body.fiber_g),
      totalSugarsG: optionalNumber(body.sugar_g),
      sodiumMg: optionalNumber(body.sodium_mg),
      saturatedFatG: optionalNumber(body.saturated_fat_g),
      cholesterolMg: optionalNumber(body.cholesterol_mg),
      nutrientValues: body.nutrient_values && typeof body.nutrient_values === 'object' && !Array.isArray(body.nutrient_values)
        ? Object.fromEntries(Object.entries(body.nutrient_values as Record<string, unknown>)
            .filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value >= 0)) : null,
      nutrientSource: typeof body.nutrient_source === 'string' ? body.nutrient_source.slice(0, 240) : null,
    };

    const food = await db.insert(schema.foods).values(foodData).returning().get();
    if (tagIds.length) {
      await db.insert(schema.foodsToFoodTags).values(tagIds.map((foodTagId) => ({ foodId: food.id, foodTagId }))).run();
    }
    return NextResponse.json({ food: {
      id: food.id, description: food.description, brand_name: food.brandName,
      brand_owner: food.brandOwner, upc_code: food.upcCode, fdc_id: food.fdcId,
      source: food.source, default_serving_size: food.defaultServingSize,
      default_serving_unit: food.defaultServingUnit, energy_kcal: food.energyKcal,
      protein_g: food.proteinG, fat_g: food.totalFatG, carbs_g: food.carbohydrateG,
      fiber_g: food.dietaryFiberG, sugar_g: food.totalSugarsG, sodium_mg: food.sodiumMg,
      saturated_fat_g: food.saturatedFatG, cholesterol_mg: food.cholesterolMg,
      nutrient_values: food.nutrientValues, nutrient_source: food.nutrientSource,
    } });
  } catch {
    return NextResponse.json({ error: 'Could not create this food.' }, { status: 500 });
  }
}
