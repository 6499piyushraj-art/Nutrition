import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getSession, logout } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = checkRateLimit('delete-account:' + session.user.id, 3, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many account deletion attempts. Try again later.' }, {
      status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) },
    });
  }

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  if (body.confirmation !== 'DELETE' || typeof body.password !== 'string' || !body.password) {
    return NextResponse.json({ error: 'Enter DELETE and your current password to confirm.' }, { status: 400 });
  }

  try {
    const user = await db.select({ id: schema.users.id, passwordHash: schema.users.passwordHash })
      .from(schema.users).where(eq(schema.users.id, session.user.id)).get();
    if (!user) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    if (!(await bcrypt.compare(body.password, user.passwordHash))) {
      return NextResponse.json({ error: 'The current password is incorrect.' }, { status: 401 });
    }

    // User-owned records are removed by their declared ON DELETE CASCADE relationships.
    const deleted = await db.delete(schema.users).where(eq(schema.users.id, session.user.id))
      .returning({ id: schema.users.id }).get();
    if (!deleted) return NextResponse.json({ error: 'Account could not be deleted.' }, { status: 500 });

    await logout();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Account deletion could not be completed. Contact support before retrying.' }, { status: 500 });
  }
}
