import { expect, test } from 'bun:test';
import { moveItem, replaceGroupOrder } from '../src/features/settings/reorder';

test('dragging moves an item to the target position in both directions', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  expect(moveItem(rows, 'a', 'c').map(row => row.id)).toEqual(['b', 'c', 'a']);
  expect(moveItem(rows, 'c', 'a').map(row => row.id)).toEqual(['c', 'a', 'b']);
  expect(rows.map(row => row.id)).toEqual(['a', 'b', 'c']);
});

test('missing or unchanged drag targets do nothing', () => {
  const rows = [{ id: 'a' }, { id: 'b' }];
  expect(moveItem(rows, 'a', 'a')).toBe(rows);
  expect(moveItem(rows, 'a', 'missing')).toBe(rows);
  expect(moveItem(rows, 'missing', 'b')).toBe(rows);
});

test('reordering a group preserves other groups and unsaved block objects', () => {
  const a = { id: 'a', courseId: 'one', content: { body: 'Unsaved text' } };
  const b = { id: 'b', courseId: 'one', content: { body: 'Second' } };
  const other = { id: 'other', courseId: 'two', content: { body: 'Other' } };
  const result = replaceGroupOrder([a, other, b], moveItem([a, b], 'b', 'a'));
  expect(result.map(row => row.id)).toEqual(['b', 'other', 'a']);
  expect(result[1]).toBe(other);
  expect(result[2]).toBe(a);
  expect(result[2].content.body).toBe('Unsaved text');
});
