import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const ACCESS_TOKEN_COOKIE = 'health_access_token';
const REFRESH_TOKEN_COOKIE = 'health_refresh_token';

interface TokenPayload { userId: string; type: 'access' | 'refresh'; }
export interface AuthUser {
  id: string; email: string; first_name: string | null; last_name: string | null; role: string;
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret === 'change-me-in-production') {
    throw new Error('JWT_SECRET must be configured with a private server-side value.');
  }
  return secret;
}

export async function login(email: string, password: string): Promise<{ user: AuthUser; error?: never } | { user?: never; error: string }> {
  const user = await db.select().from(schema.users).where(eq(schema.users.email, email.trim().toLowerCase())).get();
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return { error: 'Invalid credentials' };
  const authUser: AuthUser = { id: user.id, email: user.email, first_name: user.firstName, last_name: user.lastName, role: user.role };
  await setTokenCookies(user.id);
  return { user: authUser };
}

export async function signup(email: string, password: string, firstName: string, lastName: string): Promise<{ user: AuthUser; error?: never } | { user?: never; error: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, normalizedEmail)).get();
  if (existing) return { error: 'Email already registered' };
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.insert(schema.users).values({
    email: normalizedEmail, passwordHash, firstName: firstName.trim(), lastName: lastName.trim(), role: 'athlete',
  }).returning().get();
  const authUser: AuthUser = { id: user.id, email: user.email, first_name: user.firstName, last_name: user.lastName, role: user.role };
  await setTokenCookies(user.id);
  return { user: authUser };
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
}

export async function getSession(): Promise<{ token: string; user: AuthUser } | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (accessToken) {
    const payload = verifyToken(accessToken, 'access');
    if (payload) {
      const user = await getUserById(payload.userId);
      if (user) return { token: accessToken, user };
    }
  }
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) return null;
  const payload = verifyToken(refreshToken, 'refresh');
  if (!payload) return null;
  const user = await getUserById(payload.userId);
  if (!user) return null;
  await setTokenCookies(payload.userId);
  return { token: signToken(payload.userId, 'access'), user };
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.token ?? null;
}

async function getUserById(id: string): Promise<AuthUser | null> {
  const user = await db.select().from(schema.users).where(eq(schema.users.id, id)).get();
  if (!user) return null;
  return { id: user.id, email: user.email, first_name: user.firstName, last_name: user.lastName, role: user.role };
}

function signToken(userId: string, type: 'access' | 'refresh'): string {
  const expiresIn = type === 'access' ? ACCESS_TOKEN_EXPIRY : REFRESH_TOKEN_EXPIRY;
  return jwt.sign({ userId, type } satisfies TokenPayload, jwtSecret(), { expiresIn });
}

function verifyToken(token: string, expectedType: 'access' | 'refresh'): TokenPayload | null {
  try {
    const payload = jwt.verify(token, jwtSecret()) as TokenPayload;
    return payload.type === expectedType && typeof payload.userId === 'string' ? payload : null;
  } catch {
    return null;
  }
}

async function setTokenCookies(userId: string): Promise<void> {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';
  cookieStore.set(ACCESS_TOKEN_COOKIE, signToken(userId, 'access'), {
    httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 15 * 60,
  });
  cookieStore.set(REFRESH_TOKEN_COOKIE, signToken(userId, 'refresh'), {
    httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
  });
}
