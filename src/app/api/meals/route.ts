import { NextResponse } from 'next/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';

type FoodInput = { food_id: string; quantity?: number };
function isFoodInput(value: unknown): value is FoodInput {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.food_id === 'string' && item.food_id.length > 0
    && (item.quantity === undefined || (typeof item.quantity === 'number' && Number.isFinite(item.quantity) && item.quantity > 0 && item.quantity <= 10000));
}
async function validateFoodIds(userId: string, items: FoodInput[]) {
  const ids = [...new Set(items.map((item) => item.food_id))];
  const foods = ids.length ? await db.select({ id: schema.foods.id }).from(schema.foods).where(and(
    eq(schema.foods.userId, userId), isNull(schema.foods.deletedAt), inArray(schema.foods.id, ids),
  )).all() : [];
  return foods.length === ids.length;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const meals: Array<typeof schema.meals.$inferSelect> = await db.select().from(schema.meals)
      .where(and(eq(schema.meals.userId, session.user.id), isNull(schema.meals.deletedAt)))
      .orderBy(schema.meals.name);

    const mealsWithDetails = await Promise.all(meals.map(async (meal) => {
      const items = await db.select({
        id: schema.mealItems.id, quantity: schema.mealItems.quantity,
        food: {
          id: schema.foods.id, description: schema.foods.description,
          energy_kcal: schema.foods.energyKcal, protein_g: schema.foods.proteinG,
          carbs_g: schema.foods.carbohydrateG, fat_g: schema.foods.totalFatG,
        },
      }).from(schema.mealItems)
        .innerJoin(schema.foods, eq(schema.mealItems.foodId, schema.foods.id))
        .where(and(
          eq(schema.mealItems.mealId, meal.id),
          eq(schema.foods.userId, session.user.id),
          isNull(schema.foods.deletedAt),
        ));

      const tagRecords: Array<{ id: string; foodTagId: string; tagName: string; tagColor: string | null }> = await db.select({
        id: schema.mealsToFoodTags.id, foodTagId: schema.mealsToFoodTags.foodTagId,
        tagName: schema.foodTags.name, tagColor: schema.foodTags.color,
      }).from(schema.mealsToFoodTags)
        .innerJoin(schema.foodTags, eq(schema.mealsToFoodTags.foodTagId, schema.foodTags.id))
        .where(and(
          eq(schema.mealsToFoodTags.mealId, meal.id),
          eq(schema.foodTags.userId, session.user.id),
          isNull(schema.foodTags.deletedAt),
        ));
      const meal_tags = tagRecords.map((record) => ({ nx_food_tags_id: { id: record.foodTagId, name: record.tagName, color: record.tagColor } }));
      return { id: meal.id, name: meal.name, description: meal.description, default_meal_type: meal.defaultMealType, items, meal_tags };
    }));
    return NextResponse.json({ meals: mealsWithDetails });
  } catch {
    return NextResponse.json({ error: 'Could not load saved meals.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  const name = body.name;
  const description = body.description;
  const items = body.food_items;
  if (typeof name !== 'string' || !name.trim() || name.length > 120) return NextResponse.json({ error: 'Meal name is required and must be 120 characters or fewer.' }, { status: 400 });
  if (items !== undefined && (!Array.isArray(items) || items.length > 100 || !items.every(isFoodInput))) return NextResponse.json({ error: 'Food items are invalid.' }, { status: 400 });

  try {
    const foodItems = (items || []) as FoodInput[];
    if (!(await validateFoodIds(session.user.id, foodItems))) return NextResponse.json({ error: 'One or more foods were not found in your library.' }, { status: 404 });

    const meal = await db.insert(schema.meals).values({
      userId: session.user.id, name: name.trim(),
      description: typeof description === 'string' ? description.trim().slice(0, 1000) : null,
      defaultMealType: typeof body.default_meal_type === 'string' ? body.default_meal_type.slice(0, 40) : null,
    }).returning().get();

    if (foodItems.length) await db.insert(schema.mealItems).values(foodItems.map((item) => ({
      mealId: meal.id, foodId: item.food_id, quantity: item.quantity ?? 1,
    }))).run();
    return NextResponse.json({ meal });
  } catch {
    return NextResponse.json({ error: 'Could not create saved meal.' }, { status: 500 });
  }
}
