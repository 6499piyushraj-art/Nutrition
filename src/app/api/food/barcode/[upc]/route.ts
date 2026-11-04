import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { isValidFoodBarcode, lookupBarcode } from '@/lib/usda';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ upc: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { upc } = await params;
  if (!isValidFoodBarcode(upc)) return NextResponse.json({ error: 'Enter a valid 8, 12, 13 or 14 digit barcode.' }, { status: 400 });

  const rate = checkRateLimit('barcode-lookup:' + session.user.id, 30, 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: 'Too many barcode lookups. Try again shortly.' }, {
    status: 429, headers: { 'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)) },
  });

  try {
    const result = await lookupBarcode(upc);
    if (!result) return NextResponse.json({
      error: 'not_found', upc, message: 'No food found for this barcode.',
      suggestion: 'Try searching by food or product name instead.',
    }, { status: 404 });
    return NextResponse.json({ ...result.food, source: result.source }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch {
    return NextResponse.json({ error: 'Barcode lookup is temporarily unavailable.' }, { status: 502 });
  }
}
