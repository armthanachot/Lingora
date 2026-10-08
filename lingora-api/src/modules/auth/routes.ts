import { and, eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { db } from '../../db';
import { users } from '../../db/schema';
import {
  buildExpiredSessionCookie,
  buildSessionCookie,
  createSession,
  destroySession,
  resolveSessionUser,
  toPublicUser,
} from './session';

const googleClientId = process.env.GOOGLE_CLIENT_ID;
if (!googleClientId) {
  throw new Error('GOOGLE_CLIENT_ID is required. Configure it in .env before starting the API.');
}

const googleClient = new OAuth2Client();
type GoogleTokenPayload = TokenPayload & { locale?: string };

const googleSignInBody = t.Object({
  credential: t.String({ minLength: 1 }),
});

const profileBody = t.Object({
  displayName: t.String({ minLength: 2, maxLength: 160 }),
});

export const authRoutes = new Elysia({ prefix: '/api/v1/auth' })
  .post(
    '/google',
    async ({ body, set }) => {
      let payload: GoogleTokenPayload | undefined;
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: body.credential,
          audience: googleClientId,
        });
        payload = ticket.getPayload();
      } catch (error) {
        console.error('Google token verification failed:', error);
        set.status = 401;
        return { error: 'Invalid Google ID token.' };
      }

      if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        set.status = 401;
        return { error: 'Google account does not contain a verified email.' };
      }

      const now = new Date();
      const providerAccountId = payload.sub;
      const [existingUser] = await db
        .select()
        .from(users)
        .where(and(eq(users.authProvider, 'google'), eq(users.providerAccountId, providerAccountId)))
        .limit(1);

      let user: typeof users.$inferSelect;
      let created = false;

      if (existingUser) {
        if (!existingUser.isActive) {
          set.status = 403;
          return { error: 'This Lingora account is inactive.' };
        }

        [user] = await db
          .update(users)
          .set({
            email: payload.email,
            firstName: payload.given_name ?? existingUser.firstName,
            lastName: payload.family_name ?? existingUser.lastName,
            avatarUrl: payload.picture ?? existingUser.avatarUrl,
            locale: payload.locale ?? existingUser.locale,
            providerEmail: payload.email,
            providerEmailVerified: true,
            providerHostedDomain: payload.hd ?? existingUser.providerHostedDomain,
            lastLoginAt: now,
            updatedAt: now,
          })
          .where(eq(users.id, existingUser.id))
          .returning();
      } else {
        const [emailOwner] = await db.select().from(users).where(eq(users.email, payload.email)).limit(1);
        if (emailOwner) {
          set.status = 409;
          return { error: 'This email is already linked to another Lingora account.' };
        }

        [user] = await db
          .insert(users)
          .values({
            email: payload.email,
            displayName: null,
            firstName: payload.given_name,
            lastName: payload.family_name,
            avatarUrl: payload.picture,
            locale: payload.locale,
            authProvider: 'google',
            providerAccountId,
            providerEmail: payload.email,
            providerEmailVerified: true,
            providerHostedDomain: payload.hd,
            lastLoginAt: now,
          })
          .returning();
        created = true;
      }

      const session = await createSession(user.id);
      set.headers['Set-Cookie'] = buildSessionCookie(session.token);
      if (created) set.status = 201;
      return { user: toPublicUser(user) };
    },
    { body: googleSignInBody },
  )
  .get('/me', async ({ request, set }) => {
    const user = await resolveSessionUser(request);
    if (!user) {
      set.status = 401;
      return { error: 'Not signed in.' };
    }
    return { user: toPublicUser(user) };
  })
  .patch(
    '/profile',
    async ({ request, body, set }) => {
      const user = await resolveSessionUser(request);
      if (!user) {
        set.status = 401;
        return { error: 'Not signed in.' };
      }

      const displayName = body.displayName.trim();
      if (displayName.length < 2) {
        set.status = 400;
        return { error: 'Display name must be at least 2 characters.' };
      }

      const [updatedUser] = await db
        .update(users)
        .set({ displayName, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();

      return { user: toPublicUser(updatedUser) };
    },
    { body: profileBody },
  )
  .post('/signout', async ({ request, set }) => {
    await destroySession(request);
    set.headers['Set-Cookie'] = buildExpiredSessionCookie();
    return { signedOut: true };
  });
