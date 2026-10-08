import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react';
import type { ThemePreference } from './theme';

type ThemeToggleProps = {
  value: ThemePreference;
  onChange: (theme: ThemePreference) => void;
  compact?: boolean;
  className?: string;
};

type DragState = {
  pointerId: number;
  startX: number;
  startOffset: number;
  currentOffset: number;
  step: number;
  moved: boolean;
  tapIndex: number;
};

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.2v2.2M12 19.6v2.2M2.2 12h2.2M19.6 12h2.2M5.1 5.1l1.55 1.55M17.35 17.35l1.55 1.55M18.9 5.1l-1.55 1.55M6.65 17.35 5.1 18.9" />
    </svg>
  );
}

function AutoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.2" y="4.5" width="13.2" height="10.2" rx="2" />
      <path d="M7.2 18.5h5.2M9.8 14.9v3.3" />
      <path className="auto-spark" d="m19.2 7 .7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7.7-1.7Z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.5 14.8A8.2 8.2 0 0 1 9.2 4.5 8.4 8.4 0 1 0 19.5 14.8Z" />
    </svg>
  );
}

const options: Array<{ value: ThemePreference; label: string; icon: () => ReactElement }> = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'auto', label: 'Auto', icon: AutoIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
];

function optionIndex(value: ThemePreference) {
  return options.findIndex((option) => option.value === value);
}

export function ThemeToggle({ value, onChange, compact = false, className = '' }: ThemeToggleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [dragPreviewIndex, setDragPreviewIndex] = useState(() => optionIndex(value));

  const isDragging = dragOffset !== null;
  const visualValue = isDragging
    ? options[Math.max(0, Math.min(2, dragPreviewIndex))].value
    : value;

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const container = containerRef.current;
    const slider = container?.querySelector<HTMLElement>('.theme-toggle-slider');
    if (!container || !slider) return;

    const step = slider.offsetWidth;
    const startIndex = optionIndex(value);
    const startOffset = Math.max(0, startIndex) * step;
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    const tapIndex = Array.from(container.querySelectorAll('button')).indexOf(target as HTMLButtonElement);

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startOffset,
      currentOffset: startOffset,
      step,
      moved: false,
      tapIndex,
    };
    setDragPreviewIndex(Math.max(0, startIndex));
    setDragOffset(startOffset);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 4) drag.moved = true;

    const nextOffset = Math.max(0, Math.min(drag.step * 2, drag.startOffset + delta));
    drag.currentOffset = nextOffset;
    const nextIndex = Math.max(0, Math.min(2, Math.round(nextOffset / drag.step)));
    setDragOffset(nextOffset);
    setDragPreviewIndex(nextIndex);
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!cancelled && (drag.moved || drag.tapIndex >= 0)) {
      suppressClickRef.current = true;
      // Pointer capture retargets the release/click to the container, so a tap
      // must use the option hit on pointer-down rather than its button onClick.
      const nextIndex = drag.moved
        ? Math.max(0, Math.min(2, Math.round(drag.currentOffset / drag.step)))
        : drag.tapIndex;
      onChange(options[nextIndex].value);
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }

    dragRef.current = null;
    setDragOffset(null);
  }

  function handleOptionClick(theme: ThemePreference) {
    if (suppressClickRef.current) return;
    onChange(theme);
  }

  const style = dragOffset === null
    ? undefined
    : ({ '--theme-drag-x': `${dragOffset}px` } as CSSProperties);

  return (
    <div
      ref={containerRef}
      className={`theme-toggle ${compact ? 'is-compact' : ''} ${isDragging ? 'is-dragging' : ''} ${className}`.trim()}
      data-active={value}
      data-visual={visualValue}
      role="group"
      aria-label="Color theme"
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishDrag(event)}
      onPointerCancel={(event) => finishDrag(event, true)}
    >
      <span className="theme-toggle-slider" aria-hidden="true" />
      {options.map((option, index) => {
        const Icon = option.icon;
        const selected = isDragging ? dragPreviewIndex === index : value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={`theme-option theme-option-${option.value}${selected ? ' is-selected' : ''}`}
            aria-pressed={value === option.value}
            aria-label={`Use ${option.label.toLowerCase()} theme`}
            title={option.label}
            onClick={() => handleOptionClick(option.value)}
          >
            <span className="theme-option-icon"><Icon /></span>
            <span className="theme-option-label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
