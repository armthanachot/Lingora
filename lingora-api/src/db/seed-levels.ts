import 'dotenv/config';
import { db, pool } from './index';
import { levels } from './schema';

const levelSeeds = [
  {
    code: 'beginner-1',
    name: 'Beginner Level 1',
    description: 'Build a first foundation with essential words, phrases, and everyday conversations.',
  },
  {
    code: 'beginner-2',
    name: 'Beginner Level 2',
    description: 'Expand basic vocabulary and sentence patterns for familiar everyday situations.',
  },
  {
    code: 'elementary-1',
    name: 'Elementary Level 1',
    description: 'Handle common routines, simple descriptions, and short practical conversations.',
  },
  {
    code: 'elementary-2',
    name: 'Elementary Level 2',
    description: 'Use a wider range of everyday language with more confidence and independence.',
  },
  {
    code: 'intermediate-1',
    name: 'Intermediate Level 1',
    description: 'Communicate about familiar topics with longer sentences and clearer detail.',
  },
  {
    code: 'intermediate-2',
    name: 'Intermediate Level 2',
    description: 'Develop fluency for broader topics, opinions, and more complex real-world situations.',
  },
  {
    code: 'advanced-1',
    name: 'Advanced Level 1',
    description: 'Use nuanced language for complex topics, professional settings, and detailed expression.',
  },
  {
    code: 'advanced-2',
    name: 'Advanced Level 2',
    description: 'Refine precision, flexibility, and natural expression across demanding contexts.',
  },
] as const;

async function seedLevels() {
  for (let index = 0; index < levelSeeds.length; index += 1) {
    const level = levelSeeds[index];

    await db
      .insert(levels)
      .values({
        ...level,
        sortOrder: index + 1,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: levels.code,
        set: {
          name: level.name,
          description: level.description,
          sortOrder: index + 1,
          isActive: true,
          deletedAt: null,
          updatedAt: new Date(),
        },
      });
  }

  console.log(`Seeded ${levelSeeds.length} learning levels.`);
}

seedLevels()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
