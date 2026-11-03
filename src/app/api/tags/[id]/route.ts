import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  const update: { name?: string; color?: string; sort?: number } = {};
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 60) return NextResponse.json({ error: 'Tag name must be 1–60 characters.' }, { status: 400 });
    update.name = body.name.trim().toLowerCase();
  }
  if (body.color !== undefined) {
    if (typeof body.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(body.color)) return NextResponse.json({ error: 'Color must be a six-digit hex value.' }, { status: 400 });
    update.color = body.color;
  }
  if (body.sort !== undefined) {
    if (typeof body.sort !== 'number' || !Number.isInteger(body.sort) || body.sort < 0 || body.sort > 10000) return NextResponse.json({ error: 'Sort order is invalid.' }, { status: 400 });
    update.sort = body.sort;
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });

  try {
    const tag = await db.update(schema.foodTags).set(update).where(and(
      eq(schema.foodTags.id, id), eq(schema.foodTags.userId, session.user.id), isNull(schema.foodTags.deletedAt),
    )).returning({
      id: schema.foodTags.id, name: schema.foodTags.name,
      color: schema.foodTags.color, sort: schema.foodTags.sort,
    }).get();
    if (!tag) return NextResponse.json({ error: 'Tag not found.' }, { status: 404 });
    return NextResponse.json({ tag });
  } catch {
    return NextResponse.json({ error: 'Could not update tag.' }, { status: 500 });
  }
}
