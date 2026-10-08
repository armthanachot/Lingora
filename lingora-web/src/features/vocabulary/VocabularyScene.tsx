import { useRef, type PointerEvent } from 'react';
import { clamp, type VocabularyItem, type VocabularyPage } from './api';
import { normalizeRotation, rotationFromPointer, transformVocabularyItem } from './geometry';

type Props = {
  page: VocabularyPage; selectedId: string; matchingIds?: Set<string>;
  onSelect: (id: string) => void; onChange?: (id: string, patch: Partial<VocabularyItem>) => void;
};
export function VocabularyScene({ page, selectedId, matchingIds, onSelect, onChange }: Props) {
  const scene = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; kind: 'object' | 'marker' | 'resize' | 'rotate'; startX: number; startY: number; centerX: number; centerY: number; item: VocabularyItem; width: number; height: number } | null>(null);
  function start(event: PointerEvent<HTMLButtonElement>, item: VocabularyItem, kind: 'object' | 'marker' | 'resize' | 'rotate') {
    onSelect(item.id);
    if (!onChange || !scene.current) return;
    event.preventDefault(); event.stopPropagation();
    const rect = scene.current.getBoundingClientRect();
    drag.current = { id: item.id, kind, startX: event.clientX, startY: event.clientY, centerX: rect.left + rect.width * item.x / 100, centerY: rect.top + rect.height * item.y / 100, item: { ...item }, width: rect.width, height: rect.height };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || !onChange) return;
    if (current.kind === 'rotate') {
      onChange(current.id, { rotation: rotationFromPointer(current.item.rotation ?? 0, { x: current.startX, y: current.startY }, { x: event.clientX, y: event.clientY }, { x: current.centerX, y: current.centerY }) });
      return;
    }
    const dx = (event.clientX - current.startX) / current.width * 100;
    const dy = (event.clientY - current.startY) / current.height * 100;
    onChange(current.id, transformVocabularyItem(current.item, current.kind, dx, dy));
  }
  const handlers = (item: VocabularyItem, kind: 'object' | 'marker' | 'resize' | 'rotate') => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => start(e, item, kind), onPointerMove: move,
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => { move(e); drag.current = null; }, onPointerCancel: () => { drag.current = null; },
    onClick: () => onSelect(item.id),
  });
  return <div ref={scene} className={`vocab-scene${onChange ? ' is-editable' : ''}`} style={{ aspectRatio: page.aspectRatio }} data-language={page.languageCode}>
    {page.backgroundUrl ? <img className="vocab-background" src={page.backgroundUrl} alt={`${page.title} scene`} draggable={false} /> : <div className="vocab-background-empty">Upload a background to begin your scene</div>}
    {page.items.map((item, index) => <div key={item.id} className={`vocab-object-layer${selectedId === item.id ? ' is-selected' : ''}${matchingIds && !matchingIds.has(item.id) ? ' is-dimmed' : ''}`}>
      {item.mode === 'object' && item.imageUrl && <button type="button" className="vocab-object" aria-label={`Select ${item.word || `object ${index + 1}`}`} style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.width}%`, zIndex: index + 1, transform: `translate(-50%, -50%) rotate(${item.rotation ?? 0}deg)` }} {...handlers(item, 'object')}>
        <img src={item.imageUrl} alt="" draggable={false} />
      </button>}
      <button type="button" className="vocab-marker" aria-label={`${index + 1}. ${item.word || 'New word'}`} style={{ left: `${item.markerX}%`, top: `${item.markerY}%`, zIndex: page.items.length + index + 1 }} {...handlers(item, 'marker')}>{index + 1}</button>
      {onChange && selectedId === item.id && item.mode === 'object' && <button type="button" className="vocab-resize" aria-label={`Resize ${item.word}`} style={{ left: `${clamp(item.x + item.width / 2, 0, 98)}%`, top: `${item.y}%`, zIndex: page.items.length * 2 + 1 }} {...handlers(item, 'resize')}>↔</button>}
      {onChange && selectedId === item.id && item.mode === 'object' && <button type="button" className="vocab-rotate" aria-label={`Rotate ${item.word}`} title="Drag to rotate freely. Arrow keys: 1°; Shift + arrow: 0.1°" style={{ left: `${clamp(item.x + item.width / 2, 2, 98)}%`, top: `${item.y}%`, transform: `translate(-50%, -50%) translateY(${item.y < 10 ? 40 : -40}px)`, zIndex: page.items.length * 2 + 2 }} {...handlers(item, 'rotate')} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); onChange(item.id, { rotation: normalizeRotation((item.rotation ?? 0) + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 0.1 : 1)) }); } }}>↻</button>}
    </div>)}
  </div>;
}

export function VocabularyWords({ page, selectedId, matchingIds, onSelect, onSpeak }: Omit<Props, 'onChange'> & { onSpeak?: (item: VocabularyItem) => void }) {
  return <section className="vocab-word-section" aria-label="Vocabulary list">
    <h2>{page.heading}</h2>
    <div className="vocab-word-grid" style={{ gridTemplateRows: `repeat(${Math.max(1, Math.ceil(page.items.length / 2))}, auto)` }}>{page.items.map((item, index) => <div key={item.id} className={`vocab-word-card${selectedId === item.id ? ' is-selected' : ''}${matchingIds && !matchingIds.has(item.id) ? ' is-dimmed' : ''}`}>
      <button type="button" className="vocab-word-select" onClick={() => onSelect(item.id)}>
        <span className="vocab-word-number">{index + 1}.</span>
        {item.imageUrl && <img src={item.imageUrl} alt="" />}
        <span><strong>{item.word || 'New word'}</strong><span className="vocab-translation">{item.translation}</span></span>
      </button>
      {onSpeak && <button type="button" className="vocab-speak" aria-label={`Read ${item.word} aloud`} onClick={() => onSpeak(item)}>🔊</button>}
    </div>)}</div>
  </section>;
}
