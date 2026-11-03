import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { runGeminiNutritionJury } from '@/lib/gemini-jury';
export const runtime = 'nodejs';
const AI_DAILY_LIMIT = 50;
const AI_WINDOW_MS = 24 * 60 * 60 * 1000;
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const type = String(body.type || '');
  const content = body.content;
  if (!content || (type !== 'text' && type !== 'image')) return NextResponse.json({ error: 'A food description or image is required.' }, { status: 400 });
  if (type === 'image' && !body.mediaType) return NextResponse.json({ error: 'Gemini image parsing requires an image media type.' }, { status: 400 });
  const { allowed, retryAfterMs } = checkRateLimit('ai:' + session.user.id, AI_DAILY_LIMIT, AI_WINDOW_MS);
  if (!allowed) {
    const hours = Math.ceil(retryAfterMs / 3600000);
    return NextResponse.json({ error: 'Daily AI limit reached. Try again in about ' + hours + ' hour(s).' }, { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } });
  }
  try {
    const result = await runGeminiNutritionJury({
      type, content: String(content), mediaType: typeof body.mediaType === 'string' ? body.mediaType : undefined,
      context: typeof body.context === 'string' ? body.context : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gemini nutrition jury failed.';
    return NextResponse.json({ error: message.includes('GEMINI_API_KEY') ? 'Gemini API key is not configured on the server.' : 'Gemini nutrition jury failed. Check model access/quota and retry.' }, { status: message.includes('GEMINI_API_KEY') ? 503 : 502 });
  }
}
