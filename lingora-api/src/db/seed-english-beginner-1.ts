import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db, pool } from './index';
import { courses, languages, lessons, modules } from './schema';

const COURSE_SLUG = 'english-for-beginners-level-1';

const moduleSeeds = [
  {
    title: 'Hello, English!',
    description: 'Start speaking with essential greetings, introductions, and friendly first conversations.',
    lessons: ['Hello & Goodbye', 'My Name Is…', 'How Are You?', 'Nice to Meet You'],
  },
  {
    title: 'About Me',
    description: 'Share basic personal information about where you are from and the languages you speak.',
    lessons: ['Countries & Nationalities', 'I Am From…', 'Languages I Speak', 'Introducing Myself'],
  },
  {
    title: 'Numbers & Everyday Basics',
    description: 'Use basic numbers for age, phone numbers, and other simple everyday information.',
    lessons: ['Numbers 1–20', 'Numbers 20–100', 'How Old Are You?', 'Phone Numbers'],
  },
  {
    title: 'People Around Me',
    description: 'Talk about family, friends, and simple ways to describe the people around you.',
    lessons: ['My Family', 'He, She & They', 'Describing People', 'This Is My Friend'],
  },
  {
    title: 'My Everyday Life',
    description: 'Talk about common daily activities and build simple sentences about your routine.',
    lessons: ['Morning to Night', 'Common Daily Verbs', 'I Usually…', 'My Daily Routine'],
  },
  {
    title: 'Food & Drinks',
    description: 'Talk about food preferences and use simple English for ordering food and drinks.',
    lessons: ['Food I Know', 'I Like / I Don’t Like', 'Drinks & Snacks', 'Ordering at a Café'],
  },
  {
    title: 'Places & Getting Around',
    description: 'Recognize common places and ask for or understand simple directions.',
    lessons: ['Places in Town', 'Where Is…?', 'Left, Right & Straight', 'Asking for Directions'],
  },
  {
    title: 'My First Conversations',
    description: 'Bring Level 1 skills together in short, practical conversations and a final review.',
    lessons: ['Meeting Someone New', 'At a Café', 'Around Town', 'Level 1 Review & Challenge'],
  },
] as const;

async function seedEnglishBeginnerLevel1() {
  const [course] = await db
    .select({
      id: courses.id,
      title: courses.title,
    })
    .from(courses)
    .innerJoin(languages, eq(courses.languageId, languages.id))
    .where(and(eq(languages.code, 'en'), eq(courses.slug, COURSE_SLUG)))
    .limit(1);

  if (!course) {
    throw new Error(
      `Course not found. Create the English course with slug "${COURSE_SLUG}" before running this seed.`,
    );
  }

  await db.transaction(async (tx) => {
    for (let moduleIndex = 0; moduleIndex < moduleSeeds.length; moduleIndex += 1) {
      const moduleSeed = moduleSeeds[moduleIndex];
      const moduleSortOrder = moduleIndex + 1;

      const [existingModule] = await tx
        .select({ id: modules.id })
        .from(modules)
        .where(and(eq(modules.courseId, course.id), eq(modules.title, moduleSeed.title)))
        .limit(1);

      const moduleId = existingModule
        ? (
            await tx
              .update(modules)
              .set({
                description: moduleSeed.description,
                sortOrder: moduleSortOrder,
                deletedAt: null,
                updatedAt: new Date(),
              })
              .where(eq(modules.id, existingModule.id))
              .returning({ id: modules.id })
          )[0].id
        : (
            await tx
              .insert(modules)
              .values({
                courseId: course.id,
                title: moduleSeed.title,
                description: moduleSeed.description,
                sortOrder: moduleSortOrder,
              })
              .returning({ id: modules.id })
          )[0].id;

      for (let lessonIndex = 0; lessonIndex < moduleSeed.lessons.length; lessonIndex += 1) {
        const lessonTitle = moduleSeed.lessons[lessonIndex];
        const lessonSortOrder = lessonIndex + 1;

        const [existingLesson] = await tx
          .select({ id: lessons.id })
          .from(lessons)
          .where(and(eq(lessons.moduleId, moduleId), eq(lessons.title, lessonTitle)))
          .limit(1);

        if (existingLesson) {
          await tx
            .update(lessons)
            .set({
              sortOrder: lessonSortOrder,
              deletedAt: null,
              updatedAt: new Date(),
            })
            .where(eq(lessons.id, existingLesson.id));
        } else {
          await tx.insert(lessons).values({
            moduleId,
            title: lessonTitle,
            sortOrder: lessonSortOrder,
            isPublished: false,
          });
        }
      }
    }
  });

  const lessonCount = moduleSeeds.reduce((total, item) => total + item.lessons.length, 0);
  console.log(
    `Seeded ${moduleSeeds.length} modules and ${lessonCount} lessons for "${course.title}".`,
  );
}

seedEnglishBeginnerLevel1()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
