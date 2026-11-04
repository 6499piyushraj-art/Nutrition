import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const foodId = body.foodId;
  if (typeof foodId !== 'string' || !foodId.trim()) {
    return NextResponse.json({ error: 'Missing foodId.' }, { status: 400 });
  }

  try {
    const updated = await db.update(schema.foods)
      .set({ deletedAt: new Date().toISOString() })
      .where(and(
        eq(schema.foods.id, foodId),
        eq(schema.foods.userId, session.user.id),
        isNull(schema.foods.deletedAt),
      ))
      .returning({ id: schema.foods.id }).get();
    if (!updated) return NextResponse.json({ error: 'Food not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Could not delete this food.' }, { status: 500 });
  }
}
