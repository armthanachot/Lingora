import 'dotenv/config';
import { cors } from '@elysia/cors';
import { Elysia } from 'elysia';
import { lessonBuilderRoutes } from './modules/admin/lesson-builder-routes';
import { adminRoutes } from './modules/admin/routes';
import { authRoutes } from './modules/auth/routes';
import { courseRoutes } from './modules/courses/routes';
import { enrollmentRoutes } from './modules/enrollments/routes';
import { homeRoutes } from './modules/home/routes';
import { languageRoutes } from './modules/languages/routes';
import { lessonRoutes } from './modules/lessons/routes';
import { moduleRoutes } from './modules/modules/routes';
import { progressRoutes } from './modules/progress/routes';
import { userRoutes } from './modules/users/routes';
import { vocabularyRoutes, adminVocabularyRoutes } from './modules/vocabulary/routes';

const port = Number(process.env.API_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('API_PORT must be a valid port.');

new Elysia()
  .use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true }))
  .get('/health', () => ({ status: 'ok' }))
  .use(authRoutes)
  .use(adminRoutes)
  .use(lessonBuilderRoutes)
  .use(homeRoutes)
  .use(userRoutes)
  .use(vocabularyRoutes)
  .use(adminVocabularyRoutes)
  .use(languageRoutes)
  .use(courseRoutes)
  .use(moduleRoutes)
  .use(lessonRoutes)
  .use(enrollmentRoutes)
  .use(progressRoutes)
  .listen(port);

console.log(`API listening on http://localhost:${port}`);
