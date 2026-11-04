import { NextResponse } from 'next/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';

type FoodInput = { food_id: string; quantity?: number };
type Context = { params: Promise<{ id: string }> };
function isFoodInput(value: unknown): value is FoodInput {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.food_id === 'string' && item.food_id.length > 0
    && (item.quantity === undefined || (typeof item.quantity === 'number' && Number.isFinite(item.quantity) && item.quantity > 0 && item.quantity <= 10000));
}

export async function POST(request: Request, { params }: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: mealId } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  if (!Array.isArray(body.food_items) || body.food_items.length === 0 || body.food_items.length > 100 || !body.food_items.every(isFoodInput)) {
    return NextResponse.json({ error: 'A valid list of food items is required.' }, { status: 400 });
  }

  try {
    const meal = await db.select({ id: schema.meals.id }).from(schema.meals).where(and(
      eq(schema.meals.id, mealId), eq(schema.meals.userId, session.user.id), isNull(schema.meals.deletedAt),
    )).get();
    if (!meal) return NextResponse.json({ error: 'Meal not found.' }, { status: 404 });

    const items = body.food_items as FoodInput[];
    const ids = [...new Set(items.map((item) => item.food_id))];
    const foods = await db.select({ id: schema.foods.id }).from(schema.foods).where(and(
      eq(schema.foods.userId, session.user.id), isNull(schema.foods.deletedAt), inArray(schema.foods.id, ids),
    )).all();
    if (foods.length !== ids.length) return NextResponse.json({ error: 'One or more foods were not found in your library.' }, { status: 404 });

    await db.insert(schema.mealItems).values(items.map((item) => ({
      mealId, foodId: item.food_id, quantity: item.quantity ?? 1,
    }))).run();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Could not add foods to saved meal.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const itemId = body.itemId;
  if (typeof itemId !== 'string' || !itemId.trim()) return NextResponse.json({ error: 'Missing itemId.' }, { status: 400 });

  try {
    const ownedItem = await db.select({ id: schema.mealItems.id }).from(schema.mealItems)
      .innerJoin(schema.meals, eq(schema.mealItems.mealId, schema.meals.id))
      .where(and(
        eq(schema.mealItems.id, itemId),
        eq(schema.meals.userId, session.user.id),
        isNull(schema.meals.deletedAt),
      )).get();
    if (!ownedItem) return NextResponse.json({ error: 'Meal item not found.' }, { status: 404 });
    await db.delete(schema.mealItems).where(eq(schema.mealItems.id, itemId)).run();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Could not remove meal item.' }, { status: 500 });
  }
}
