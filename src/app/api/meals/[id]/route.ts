import { NextResponse } from 'next/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';

type Context = { params: Promise<{ id: string }> };
type TagRow = { id: string; foodTagId: string; tagName: string; tagColor: string | null };

async function ownedMeal(mealId: string, userId: string) {
  return db.select().from(schema.meals).where(and(
    eq(schema.meals.id, mealId), eq(schema.meals.userId, userId), isNull(schema.meals.deletedAt),
  )).get();
}

export async function GET(_request: Request, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const meal = await ownedMeal(id, session.user.id);
    if (!meal) return NextResponse.json({ error: 'Meal not found.' }, { status: 404 });
    const items = await db.select({
      id: schema.mealItems.id, quantity: schema.mealItems.quantity,
      food: {
        id: schema.foods.id, description: schema.foods.description, brand_name: schema.foods.brandName,
        energy_kcal: schema.foods.energyKcal, protein_g: schema.foods.proteinG,
        carbs_g: schema.foods.carbohydrateG, fat_g: schema.foods.totalFatG,
      },
    }).from(schema.mealItems)
      .innerJoin(schema.foods, eq(schema.mealItems.foodId, schema.foods.id))
      .where(and(
        eq(schema.mealItems.mealId, id), eq(schema.foods.userId, session.user.id), isNull(schema.foods.deletedAt),
      ));
    const tags: TagRow[] = await db.select({
      id: schema.mealsToFoodTags.id, foodTagId: schema.mealsToFoodTags.foodTagId,
      tagName: schema.foodTags.name, tagColor: schema.foodTags.color,
    }).from(schema.mealsToFoodTags)
      .innerJoin(schema.foodTags, eq(schema.mealsToFoodTags.foodTagId, schema.foodTags.id))
      .where(and(
        eq(schema.mealsToFoodTags.mealId, id), eq(schema.foodTags.userId, session.user.id), isNull(schema.foodTags.deletedAt),
      ));
    const tag_ids = tags.map((tag) => tag.foodTagId);
    const tag_objects = tags.map((tag) => ({ id: tag.foodTagId, name: tag.tagName, color: tag.tagColor }));
    const meal_tags = tags.map((tag) => ({ nx_food_tags_id: { id: tag.foodTagId, name: tag.tagName, color: tag.tagColor } }));
    return NextResponse.json({ meal: {
      id: meal.id, name: meal.name, description: meal.description,
      default_meal_type: meal.defaultMealType, user: meal.userId, items, tag_ids, tag_objects, meal_tags,
    } });
  } catch {
    return NextResponse.json({ error: 'Could not load saved meal.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  if (!(await ownedMeal(id, session.user.id))) return NextResponse.json({ error: 'Meal not found.' }, { status: 404 });

  const updates: Record<string, string | null> = {};
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 120) return NextResponse.json({ error: 'Meal name is invalid.' }, { status: 400 });
    updates.name = body.name.trim();
  }
  if (body.description !== undefined) updates.description = typeof body.description === 'string' ? body.description.trim().slice(0, 1000) : null;
  if (body.default_meal_type !== undefined) updates.defaultMealType = typeof body.default_meal_type === 'string' ? body.default_meal_type.slice(0, 40) : null;

  try {
    if (Object.keys(updates).length) await db.update(schema.meals).set(updates).where(and(
      eq(schema.meals.id, id), eq(schema.meals.userId, session.user.id),
    )).run();

    if (body.tag_ids !== undefined) {
      if (!Array.isArray(body.tag_ids) || body.tag_ids.length > 100 || !body.tag_ids.every((tag) => typeof tag === 'string')) {
        return NextResponse.json({ error: 'Tag IDs must be a list of at most 100 IDs.' }, { status: 400 });
      }
      const ids = [...new Set(body.tag_ids as string[])];
      const ownTags = ids.length ? await db.select({ id: schema.foodTags.id }).from(schema.foodTags).where(and(
        eq(schema.foodTags.userId, session.user.id), isNull(schema.foodTags.deletedAt), inArray(schema.foodTags.id, ids),
      )) : [];
      if (ownTags.length !== ids.length) return NextResponse.json({ error: 'One or more tags were not found.' }, { status: 404 });
      await db.delete(schema.mealsToFoodTags).where(eq(schema.mealsToFoodTags.mealId, id)).run();
      if (ids.length) await db.insert(schema.mealsToFoodTags).values(ids.map((foodTagId) => ({ mealId: id, foodTagId }))).run();
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Could not update saved meal.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const deleted = await db.update(schema.meals).set({ deletedAt: new Date().toISOString() })
      .where(and(eq(schema.meals.id, id), eq(schema.meals.userId, session.user.id), isNull(schema.meals.deletedAt)))
      .returning({ id: schema.meals.id }).get();
    if (!deleted) return NextResponse.json({ error: 'Meal not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Could not delete saved meal.' }, { status: 500 });
  }
}
