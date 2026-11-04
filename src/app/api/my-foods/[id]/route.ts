import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { and, eq, inArray, isNull } from 'drizzle-orm';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    const food = await db.select({
      id: schema.foods.id,
      description: schema.foods.description,
      brandName: schema.foods.brandName,
      brandOwner: schema.foods.brandOwner,
      upcCode: schema.foods.upcCode,
      fdcId: schema.foods.fdcId,
      source: schema.foods.source,
      defaultServingSize: schema.foods.defaultServingSize,
      defaultServingUnit: schema.foods.defaultServingUnit,
      energyKcal: schema.foods.energyKcal,
      proteinG: schema.foods.proteinG,
      totalFatG: schema.foods.totalFatG,
      carbohydrateG: schema.foods.carbohydrateG,
      dietaryFiberG: schema.foods.dietaryFiberG,
      totalSugarsG: schema.foods.totalSugarsG,
      sodiumMg: schema.foods.sodiumMg,
      saturatedFatG: schema.foods.saturatedFatG,
      cholesterolMg: schema.foods.cholesterolMg,
      nutrientValues: schema.foods.nutrientValues,
      nutrientSource: schema.foods.nutrientSource,
      deletedAt: schema.foods.deletedAt,
      createdAt: schema.foods.createdAt,
    }).from(schema.foods).where(and(
      eq(schema.foods.id, id),
      eq(schema.foods.userId, session.user.id),
      isNull(schema.foods.deletedAt),
    )).get();

    if (!food) return NextResponse.json({ error: 'Food not found.' }, { status: 404 });

    const tags: Array<{ id: string; name: string; color: string | null }> = await db.select({
      id: schema.foodTags.id, name: schema.foodTags.name, color: schema.foodTags.color,
    }).from(schema.foodsToFoodTags)
      .innerJoin(schema.foodTags, eq(schema.foodsToFoodTags.foodTagId, schema.foodTags.id))
      .where(and(
        eq(schema.foodsToFoodTags.foodId, id),
        eq(schema.foodTags.userId, session.user.id),
        isNull(schema.foodTags.deletedAt),
      )).all();

    return NextResponse.json({ food: {
      id: food.id, description: food.description, brand_name: food.brandName,
      brand_owner: food.brandOwner, upc_code: food.upcCode, fdc_id: food.fdcId,
      source: food.source, default_serving_size: food.defaultServingSize,
      default_serving_unit: food.defaultServingUnit, energy_kcal: food.energyKcal,
      protein_g: food.proteinG, fat_g: food.totalFatG, carbs_g: food.carbohydrateG,
      fiber_g: food.dietaryFiberG, sugar_g: food.totalSugarsG, sodium_mg: food.sodiumMg,
      saturated_fat_g: food.saturatedFatG, cholesterol_mg: food.cholesterolMg,
      nutrient_values: food.nutrientValues, nutrient_source: food.nutrientSource,
      created_at: food.createdAt, tag_ids: tags.map((tag) => tag.id),
      tag_names: tags.map((tag) => tag.name), tag_objects: tags,
    } });
  } catch {
    return NextResponse.json({ error: 'Could not load this food.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  const owned = await db.select({ id: schema.foods.id }).from(schema.foods).where(and(
    eq(schema.foods.id, id), eq(schema.foods.userId, session.user.id), isNull(schema.foods.deletedAt),
  )).get();
  if (!owned) return NextResponse.json({ error: 'Food not found.' }, { status: 404 });

  const { tag_ids, ...foodFields } = body;
  const fieldMapping: Record<string, string> = {
    description: 'description', brand_name: 'brandName', brand_owner: 'brandOwner',
    upc_code: 'upcCode', fdc_id: 'fdcId', source: 'source',
    default_serving_size: 'defaultServingSize', default_serving_unit: 'defaultServingUnit',
    energy_kcal: 'energyKcal', protein_g: 'proteinG', fat_g: 'totalFatG',
    carbs_g: 'carbohydrateG', fiber_g: 'dietaryFiberG', sugar_g: 'totalSugarsG',
    sodium_mg: 'sodiumMg', saturated_fat_g: 'saturatedFatG',
    cholesterol_mg: 'cholesterolMg', nutrient_values: 'nutrientValues',
    nutrient_source: 'nutrientSource',
  };
  const numericFields = new Set([
    'default_serving_size', 'energy_kcal', 'protein_g', 'fat_g', 'carbs_g',
    'fiber_g', 'sugar_g', 'sodium_mg', 'saturated_fat_g', 'cholesterol_mg',
  ]);
  const stringLimits: Record<string, number> = {
    brand_name: 160, brand_owner: 160, upc_code: 32, source: 80,
    default_serving_unit: 40, nutrient_source: 240,
  };

  try {
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(foodFields)) {
      const field = fieldMapping[key];
      if (!field) continue;

      if (key === 'description') {
        if (typeof value !== 'string' || !value.trim() || value.trim().length > 180) {
          return NextResponse.json({ error: 'Food name must be 1–180 characters.' }, { status: 400 });
        }
        updateData[field] = value.trim();
        continue;
      }

      if (numericFields.has(key)) {
        if (value === null || value === '') {
          updateData[field] = null;
        } else if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10000000
            || (key === 'default_serving_size' && value === 0)) {
          return NextResponse.json({ error: key + ' must be a valid non-negative number.' }, { status: 400 });
        } else {
          updateData[field] = value;
        }
        continue;
      }

      if (key === 'fdc_id') {
        if (value === null || value === '') updateData[field] = null;
        else if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
          return NextResponse.json({ error: 'fdc_id must be a positive integer.' }, { status: 400 });
        } else updateData[field] = value;
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(stringLimits, key)) {
        const max = stringLimits[key];
        if (value === null || value === '') updateData[field] = null;
        else if (typeof value !== 'string' || value.length > max) {
          return NextResponse.json({ error: key + ' must be text of at most ' + max + ' characters.' }, { status: 400 });
        } else updateData[field] = value.trim();
        continue;
      }

      if (key === 'nutrient_values') {
        if (value === null) {
          updateData[field] = null;
        } else if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return NextResponse.json({ error: 'nutrient_values must be an object of non-negative numeric values.' }, { status: 400 });
        } else {
          const parsed: Record<string, number> = {};
          for (const [nutrient, amount] of Object.entries(value as Record<string, unknown>)) {
            if (!nutrient.trim() || nutrient.length > 64 || typeof amount !== 'number'
                || !Number.isFinite(amount) || amount < 0 || amount > 10000000) {
              return NextResponse.json({ error: 'nutrient_values contains an invalid nutrient value.' }, { status: 400 });
            }
            parsed[nutrient] = amount;
          }
          updateData[field] = parsed;
        }
      }
    }

    let uniqueTagIds: string[] | null = null;
    if (tag_ids !== undefined) {
      if (!Array.isArray(tag_ids) || !tag_ids.every((tag) => typeof tag === 'string') || tag_ids.length > 100) {
        return NextResponse.json({ error: 'Tag IDs must be a list of at most 100 IDs.' }, { status: 400 });
      }
      uniqueTagIds = [...new Set(tag_ids as string[])];
      const ownedTags = uniqueTagIds.length ? await db.select({ id: schema.foodTags.id })
        .from(schema.foodTags).where(and(
          eq(schema.foodTags.userId, session.user.id),
          isNull(schema.foodTags.deletedAt),
          inArray(schema.foodTags.id, uniqueTagIds),
        )).all() : [];
      if (ownedTags.length !== uniqueTagIds.length) {
        return NextResponse.json({ error: 'One or more tags were not found.' }, { status: 404 });
      }
    }

    // All request validation and ownership checks complete before the first write.
    await db.transaction(async (tx: any) => {
      if (Object.keys(updateData).length) {
        await tx.update(schema.foods).set(updateData).where(and(
          eq(schema.foods.id, id), eq(schema.foods.userId, session.user.id),
        ));
      }
      if (uniqueTagIds !== null) {
        await tx.delete(schema.foodsToFoodTags).where(eq(schema.foodsToFoodTags.foodId, id));
        if (uniqueTagIds.length) {
          await tx.insert(schema.foodsToFoodTags).values(uniqueTagIds.map((foodTagId) => ({ foodId: id, foodTagId })));
        }
      }
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Could not update this food.' }, { status: 500 });
  }
}
