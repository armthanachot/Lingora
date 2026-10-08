import { useRef, useState } from 'react';

export function useDragReorder(onReorder: (sourceId: string, targetId: string) => void, disabled: boolean) {
  const source = useRef<{ id: string; scope: string; x: number; y: number; moved: boolean; target: string } | null>(null);
  const [draggingId, setDraggingId] = useState('');
  const [targetId, setTargetId] = useState('');
  function reset() { source.current = null; setDraggingId(''); setTargetId(''); }
  function valid(id: string, scope: string) {
    return !disabled && source.current?.scope === scope && source.current.id !== id;
  }
  function rowProps(id: string, scope: string) {
    return { 'data-reorder-id': id, 'data-reorder-scope': scope };
  }
  function handle(id: string, scope: string, label: string, ids: string[]) {
    return <button type="button" className="settings-drag-handle"
      disabled={disabled || ids.length < 2} aria-label={`Reorder ${label}`}
      title="Drag to reorder, or focus and press ↑ / ↓" onClick={event => event.stopPropagation()}
      onPointerDown={event => {
        if (disabled || event.button !== 0 || ids.length < 2) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        source.current = { id, scope, x: event.clientX, y: event.clientY, moved: false, target: '' };
      }} onPointerMove={event => {
        const from = source.current;
        if (!from || disabled) return;
        if (!from.moved && Math.hypot(event.clientX - from.x, event.clientY - from.y) < 6) return;
        from.moved = true;
        setDraggingId(from.id);
        const row = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-reorder-id]');
        const to = row?.getAttribute('data-reorder-id') ?? '';
        from.target = to && valid(to, row?.getAttribute('data-reorder-scope') ?? '') ? to : '';
        setTargetId(from.target);
        if (event.clientY < 60) window.scrollBy(0, -20);
        else if (event.clientY > window.innerHeight - 60) window.scrollBy(0, 20);
      }} onPointerUp={event => {
        const from = source.current;
        reset();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (!disabled && from?.moved && from.target) onReorder(from.id, from.target);
      }} onPointerCancel={reset} onLostPointerCapture={reset} onKeyDown={event => {
        if (event.key === 'Escape') { reset(); return; }
        if (disabled || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
        event.preventDefault();
        const index = ids.indexOf(id);
        const to = index + (event.key === 'ArrowUp' ? -1 : 1);
        if (index >= 0 && ids[to]) onReorder(id, ids[to]);
      }}>
      <svg viewBox="0 0 16 20" aria-hidden="true"><circle cx="5" cy="4" r="1.5" /><circle cx="11" cy="4" r="1.5" /><circle cx="5" cy="10" r="1.5" /><circle cx="11" cy="10" r="1.5" /><circle cx="5" cy="16" r="1.5" /><circle cx="11" cy="16" r="1.5" /></svg>
    </button>;
  }
  return { rowProps, handle, draggingId, targetId };
}
