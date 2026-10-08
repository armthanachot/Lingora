import { expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';

// Test route authorization and account isolation without changing real user preferences.
let signedIn: { id: string } | null = null;
const preferences = new Map<string, boolean>();
mock.module('../src/modules/auth/session', () => ({
  resolveSessionUser: async () => signedIn,
  toPublicUser: (user: unknown) => user,
}));
mock.module('../src/db', () => ({ db: {
  select: () => ({ from: () => ({ where: async () => {
    const value = preferences.get(signedIn!.id);
    return value === undefined ? [] : [{ autoRead: value }];
  } }) }),
  insert: () => ({ values: (value: { userId: string; autoRead: boolean }) => ({
    onConflictDoUpdate: () => ({ returning: async () => {
      preferences.set(value.userId, value.autoRead);
      return [{ autoRead: value.autoRead }];
    } }),
  }) }),
} }));
const { userRoutes } = await import('../src/modules/users/routes');
const app = new Elysia().use(userRoutes);
const call = (body?: Record<string, unknown>) => app.handle(new Request('http://localhost/api/v1/users/me/reading-preferences', body ? {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
} : undefined));

test('anonymous users cannot read or save preferences', async () => {
  signedIn = null;
  expect((await call()).status).toBe(401);
  expect((await call({ autoRead: true })).status).toBe(401);
  expect(preferences.size).toBe(0);
});

test('manual is the default, settings persist and stay isolated by session user', async () => {
  signedIn = { id: 'user-a' };
  expect(await (await call()).json()).toEqual({ autoRead: false });
  expect(await (await call({ autoRead: true, userId: 'user-b' })).json()).toEqual({ autoRead: true });
  expect(preferences.get('user-a')).toBe(true);
  expect(preferences.has('user-b')).toBe(false);
  signedIn = { id: 'user-b' };
  expect(await (await call()).json()).toEqual({ autoRead: false });
  signedIn = { id: 'user-a' };
  expect(await (await call()).json()).toEqual({ autoRead: true });
  expect(await (await call({ autoRead: false })).json()).toEqual({ autoRead: false });
});

test('auto read accepts only a boolean', async () => {
  signedIn = { id: 'user-a' };
  expect((await call({ autoRead: 'true' })).status).toBe(422);
  expect(preferences.get('user-a')).toBe(false);
});
