import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, pool } from './index';
import { users } from './schema';

const email = Bun.argv.slice(2).find((argument) => argument !== '--' && !argument.startsWith('-'))?.trim().toLowerCase();
if (!email) {
  console.error('Usage: bun src/db/promote-super-admin.ts <email>');
  process.exit(1);
}

const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
if (!user) {
  console.error(`User not found: ${email}. Sign in once before promoting this account.`);
  await pool.end();
  process.exit(1);
}

const [updated] = await db
  .update(users)
  .set({ isSuperAdmin: true, updatedAt: new Date() })
  .where(eq(users.id, user.id))
  .returning({ id: users.id, email: users.email, displayName: users.displayName, isSuperAdmin: users.isSuperAdmin });

console.log('Super admin enabled:', updated);
await pool.end();
