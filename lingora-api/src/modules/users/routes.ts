import { and, eq, ne } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { userReadingPreferences, users } from '../../db/schema';
import { resolveSessionUser, toPublicUser } from '../auth/session';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const userPatchBody = t.Object({
  displayName: t.Optional(t.String({ minLength: 2, maxLength: 160 })),
  isSuperAdmin: t.Optional(t.Boolean()),
});

async function requireSuperAdmin(request: Request) {
  const user = await resolveSessionUser(request);
  return user?.isSuperAdmin ? user : null;
}

export const userRoutes = new Elysia({ prefix: '/api/v1/users' })
  .get('/me/reading-preferences', async ({ request, set }) => {
    const user = await resolveSessionUser(request);
    if (!user) { set.status = 401; return { error: 'Not signed in.' }; }
    const [preference] = await db.select({ autoRead: userReadingPreferences.autoRead })
      .from(userReadingPreferences).where(eq(userReadingPreferences.userId, user.id));
    return preference ?? { autoRead: false };
  })
  .patch('/me/reading-preferences', async ({ request, body, set }) => {
    const user = await resolveSessionUser(request);
    if (!user) { set.status = 401; return { error: 'Not signed in.' }; }
    const [preference] = await db.insert(userReadingPreferences)
      .values({ userId: user.id, autoRead: body.autoRead })
      .onConflictDoUpdate({ target: userReadingPreferences.userId,
        set: { autoRead: body.autoRead, updatedAt: new Date() } })
      .returning({ autoRead: userReadingPreferences.autoRead });
    return preference;
  }, { body: t.Object({ autoRead: t.Boolean() }) })
  .get('/', async ({ request, set }) => {
    if (!(await requireSuperAdmin(request))) {
      set.status = 403;
      return { error: 'Super admin access required.' };
    }

    const rows = await db.select().from(users).orderBy(users.createdAt);
    return rows.map(toPublicUser);
  })
  .get('/:id', async ({ request, params, set }) => {
    if (!(await requireSuperAdmin(request))) {
      set.status = 403;
      return { error: 'Super admin access required.' };
    }
    if (!uuidPattern.test(params.id)) {
      set.status = 400;
      return { error: 'Invalid user ID' };
    }

    const [user] = await db.select().from(users).where(eq(users.id, params.id)).limit(1);
    if (!user) {
      set.status = 404;
      return { error: 'User not found' };
    }

    return toPublicUser(user);
  })
  .patch(
    '/:id',
    async ({ request, params, body, set }) => {
      if (!(await requireSuperAdmin(request))) {
        set.status = 403;
        return { error: 'Super admin access required.' };
      }
      if (!uuidPattern.test(params.id)) {
        set.status = 400;
        return { error: 'Invalid user ID' };
      }
      if (Object.keys(body).length === 0) {
        set.status = 400;
        return { error: 'No fields to update' };
      }

      const displayName = body.displayName?.trim();
      if (body.displayName !== undefined && (!displayName || displayName.length < 2)) {
        set.status = 400;
        return { error: 'Display name must be at least 2 characters.' };
      }

      if (body.isSuperAdmin === false) {
        const [target] = await db
          .select({ id: users.id, isSuperAdmin: users.isSuperAdmin })
          .from(users)
          .where(eq(users.id, params.id))
          .limit(1);

        if (!target) {
          set.status = 404;
          return { error: 'User not found' };
        }

        if (target.isSuperAdmin) {
          const [otherSuperAdmin] = await db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.isSuperAdmin, true), ne(users.id, params.id)))
            .limit(1);
          if (!otherSuperAdmin) {
            set.status = 400;
            return { error: 'At least one super admin must remain.' };
          }
        }
      }

      const [user] = await db
        .update(users)
        .set({
          ...(displayName !== undefined ? { displayName } : {}),
          ...(body.isSuperAdmin !== undefined ? { isSuperAdmin: body.isSuperAdmin } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, params.id))
        .returning();

      if (!user) {
        set.status = 404;
        return { error: 'User not found' };
      }

      return toPublicUser(user);
    },
    { body: userPatchBody },
  );
