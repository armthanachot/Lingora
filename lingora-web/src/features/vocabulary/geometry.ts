import { clamp, type VocabularyItem } from './api';

export const normalizeRotation = (degrees: number) => ((degrees % 360) + 360) % 360;
export function rotationFromPointer(rotation: number, start: { x: number; y: number }, current: { x: number; y: number }, center: { x: number; y: number }) {
  if (Math.hypot(current.x - center.x, current.y - center.y) < 2) return normalizeRotation(rotation);
  const initial = Math.atan2(start.y - center.y, start.x - center.x);
  const angle = Math.atan2(current.y - center.y, current.x - center.x);
  return normalizeRotation(rotation + (angle - initial) * 180 / Math.PI);
}

export function transformVocabularyItem(item: VocabularyItem, kind: 'object' | 'marker' | 'resize', dx: number, dy: number): Partial<VocabularyItem> {
  if (kind === 'marker') return { markerX: clamp(item.markerX + dx, 2, 98), markerY: clamp(item.markerY + dy, 3, 97) };
  if (kind === 'resize') {
    const width = clamp(item.width + dx * 2, 2, 80);
    const scale = width / item.width;
    return { width, markerX: clamp(item.x + (item.markerX - item.x) * scale, 2, 98), markerY: clamp(item.y + (item.markerY - item.y) * scale, 3, 97) };
  }
  const x = clamp(item.x + dx, 2, 98), y = clamp(item.y + dy, 3, 97);
  return { x, y, markerX: clamp(item.markerX + x - item.x, 2, 98), markerY: clamp(item.markerY + y - item.y, 3, 97) };
}
