import 'dotenv/config';
import { afterAll, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { pool } from '../src/db';
import { courseRoutes } from '../src/modules/courses/routes';
import { lessonRoutes } from '../src/modules/lessons/routes';
import { enrollmentRoutes } from '../src/modules/enrollments/routes';
import { progressRoutes } from '../src/modules/progress/routes';

// Uses only SELECTs against local configured data. No test records or sessions are created.
const app = new Elysia().use(courseRoutes).use(lessonRoutes).use(enrollmentRoutes).use(progressRoutes);
const request = (path: string, init?: RequestInit) => app.handle(new Request(`http://localhost/api/v1${path}`, init));
afterAll(() => pool.end());

test('starting a course requires sign-in', async () => {
  const response = await request('/enrollments/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId: '00000000-0000-4000-8000-000000000000' }) });
  expect(response.status).toBe(401);
});

test('progress cannot be read or submitted anonymously', async () => {
  const id = '00000000-0000-4000-8000-000000000000';
  expect((await request(`/progress/lesson/${id}`)).status).toBe(401);
  expect((await request(`/progress/lesson/${id}/blocks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response: { viewed: true } }) })).status).toBe(401);
});

test('invalid course and lesson links produce validation errors, not database errors', async () => {
  expect((await request('/courses/not-a-uuid/outline')).status).toBe(422);
  expect((await request('/lessons/not-a-uuid')).status).toBe(422);
});

test('public catalogs expose only published courses and lessons under published parents', async () => {
  const response = await request('/courses/');
  expect(response.status).toBe(200);
  const courses = await response.json() as { id: string; isPublished: boolean }[];
  expect(courses.every(course => course.isPublished)).toBe(true);
  const lessonResponse = await request('/lessons/');
  expect(lessonResponse.status).toBe(200);
  const lessons = await lessonResponse.json() as { isPublished: boolean; content: unknown }[];
  expect(lessons.every(lesson => lesson.isPublished && lesson.content === null)).toBe(true);
});

test('draft content is also hidden when its identifier is known', async () => {
  const draft = await pool.query('select id from courses where is_published = false and deleted_at is null limit 1');
  if (draft.rows[0]) {
    const id = draft.rows[0].id;
    expect((await request(`/courses/${id}`)).status).toBe(404);
    expect((await request(`/courses/${id}/outline`)).status).toBe(404);
    const child = await pool.query('select l.id from lessons l join modules m on m.id = l.module_id where m.course_id = $1 and l.deleted_at is null limit 1', [id]);
    if (child.rows[0]) expect((await request(`/lessons/${child.rows[0].id}`)).status).toBe(404);
  }
});
