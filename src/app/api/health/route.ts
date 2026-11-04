import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ status: 'not_ready', database: 'not_configured' }, { status: 503 });
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-in-production') {
      return NextResponse.json({ status: 'not_ready', authentication: 'not_configured' }, { status: 503 });
    }
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: 'ok', database: 'connected', authentication: 'configured', timestamp: new Date().toISOString() }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch {
    return NextResponse.json({ status: 'not_ready', database: 'unavailable' }, { status: 503 });
  }
}
