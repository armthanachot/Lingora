import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '../../db';
import { sessions, users } from '../../db/schema';

const SESSION_COOKIE_NAME = 'lingora_session';
const SESSION_TTL_DAYS = 30;
const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;

export type UserRow = typeof users.$inferSelect;

export function toPublicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    locale: user.locale,
    role: user.role,
    isActive: user.isActive,
    isSuperAdmin: user.isSuperAdmin,
    authProvider: user.authProvider,
    providerEmail: user.providerEmail,
    providerEmailVerified: user.providerEmailVerified,
    providerHostedDomain: user.providerHostedDomain,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName !== name) continue;
    try {
      return decodeURIComponent(rawValue.join('='));
    } catch {
      return null;
    }
  }
  return null;
}

function secureCookieSuffix() {
  const productionOrigin = process.env.CORS_ORIGIN?.trim().startsWith('https://') ?? false;
  return process.env.NODE_ENV === 'production' || productionOrigin ? '; Secure' : '';
}

export function buildSessionCookie(token: string) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secureCookieSuffix()}`;
}

export function buildExpiredSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookieSuffix()}`;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

  await db.insert(sessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    lastSeenAt: now,
  });

  return { token, expiresAt };
}

export async function destroySession(request: Request) {
  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
}

export async function resolveSessionUser(request: Request) {
  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);

  if (!session) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, session.userId), eq(users.isActive, true)))
    .limit(1);

  if (!user) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }

  if (now.getTime() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await db.update(sessions).set({ lastSeenAt: now, updatedAt: now }).where(eq(sessions.id, session.id));
  }
  return user;
}
