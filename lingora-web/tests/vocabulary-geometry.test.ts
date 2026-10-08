import { expect, test } from 'bun:test';
import { normalizeRotation, rotationFromPointer, transformVocabularyItem } from '../src/features/vocabulary/geometry';
import type { VocabularyItem } from '../src/features/vocabulary/api';

const item: VocabularyItem = { id: 'bear', word: 'teddy bear', translation: 'ตุ๊กตาหมี', description: '', imageUrl: '/assets/bear.png', mode: 'object', x: 50, y: 50, width: 20, markerX: 42, markerY: 58 };
test('moving an object carries its number, while moving a number leaves the object in place', () => {
  const moved = { ...item, ...transformVocabularyItem(item, 'object', 10, -5) };
  expect([moved.x, moved.y, moved.markerX, moved.markerY]).toEqual([60, 45, 52, 53]);
  const labelMoved = { ...item, ...transformVocabularyItem(item, 'marker', 10, -5) };
  expect([labelMoved.x, labelMoved.y, labelMoved.markerX, labelMoved.markerY]).toEqual([50, 50, 52, 53]);
  expect(moved.id).toBe(item.id);
});
test('rotation follows pointer angles without snapping and crosses the 360 degree boundary', () => {
  const center = { x: 200, y: 100 };
  const start = { x: 300, y: 100 };
  const angle = 37.25 * Math.PI / 180;
  expect(rotationFromPointer(0, start, { x: 200 + Math.cos(angle) * 100, y: 100 + Math.sin(angle) * 100 }, center)).toBeCloseTo(37.25, 8);
  expect(rotationFromPointer(350, start, { x: 200, y: 200 }, center)).toBe(80);
  expect(rotationFromPointer(0, start, { x: 200, y: 0 }, center)).toBe(270);
  expect(normalizeRotation(720.5)).toBe(0.5);
  expect(normalizeRotation(-0.1)).toBeCloseTo(359.9, 8);
  expect(rotationFromPointer(12, start, center, center)).toBe(12);
});
test('resizing keeps the number offset proportional and canvas coordinates bounded', () => {
  const resized = { ...item, ...transformVocabularyItem(item, 'resize', 10, 0) };
  expect([resized.width, resized.markerX, resized.markerY]).toEqual([40, 34, 66]);
  const edge = { ...item, ...transformVocabularyItem(item, 'object', 500, -500) };
  expect(edge.x).toBe(98); expect(edge.y).toBe(3);
  expect(edge.markerX).toBeGreaterThanOrEqual(2); expect(edge.markerX).toBeLessThanOrEqual(98);
  expect(transformVocabularyItem(item, 'resize', -500, 0).width).toBe(2);
  expect(transformVocabularyItem(item, 'resize', 500, 0).width).toBe(80);
});
