import { NextResponse } from 'next/server';
import { signup } from '@/lib/auth';
import { checkRateLimit, clearRateLimit } from '@/lib/rate-limit';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 60 * 1000;

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')
    || request.headers.get('x-real-ip')
    || 'unknown';
  return forwarded.split(',')[0].trim().slice(0, 80);
}

function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const key = `signup:${ip}`;
  const limit = checkRateLimit(key, MAX_ATTEMPTS, WINDOW_MS);
  if (!limit.allowed) {
    const retryAfter = Math.ceil(limit.retryAfterMs / 1000);
    return NextResponse.json({ error: 'Too many account creation attempts. Try again later.' }, {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    });
  }

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';

  if (!email || !password || !firstName || !lastName) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
  }
  if (!validEmail(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: 'Password must be 8–128 characters long.' }, { status: 400 });
  }
  if (firstName.length > 60 || lastName.length > 60) {
    return NextResponse.json({ error: 'Names must be 60 characters or fewer.' }, { status: 400 });
  }

  try {
    const result = await signup(email, password, firstName, lastName);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    clearRateLimit(key);
    return NextResponse.json({ user: result.user });
  } catch {
    return NextResponse.json({ error: 'Account creation could not be completed. Please try again.' }, { status: 500 });
  }
}
