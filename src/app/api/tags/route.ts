import { NextResponse } from 'next/server';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const tags = await db.select({
      id: schema.foodTags.id, name: schema.foodTags.name,
      color: schema.foodTags.color, sort: schema.foodTags.sort,
    }).from(schema.foodTags).where(and(
      eq(schema.foodTags.userId, session.user.id), isNull(schema.foodTags.deletedAt),
    )).orderBy(asc(schema.foodTags.sort), asc(schema.foodTags.name));
    return NextResponse.json({ tags });
  } catch {
    return NextResponse.json({ error: 'Could not load tags.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 60) return NextResponse.json({ error: 'Tag name must be 1–60 characters.' }, { status: 400 });
  const color = body.color === undefined ? '#2EA96B' : body.color;
  if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) return NextResponse.json({ error: 'Color must be a six-digit hex value.' }, { status: 400 });

  try {
    const tag = await db.insert(schema.foodTags).values({
      userId: session.user.id, name: body.name.trim().toLowerCase(), color, sort: 0,
    }).returning({
      id: schema.foodTags.id, name: schema.foodTags.name,
      color: schema.foodTags.color, sort: schema.foodTags.sort,
    }).get();
    return NextResponse.json({ tag });
  } catch {
    return NextResponse.json({ error: 'Could not create tag.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const tagId = body.tagId;
  if (typeof tagId !== 'string' || !tagId.trim()) return NextResponse.json({ error: 'Missing tagId.' }, { status: 400 });
  try {
    const deleted = await db.update(schema.foodTags).set({ deletedAt: new Date().toISOString() })
      .where(and(eq(schema.foodTags.id, tagId), eq(schema.foodTags.userId, session.user.id), isNull(schema.foodTags.deletedAt)))
      .returning({ id: schema.foodTags.id }).get();
    if (!deleted) return NextResponse.json({ error: 'Tag not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Could not delete tag.' }, { status: 500 });
  }
}
