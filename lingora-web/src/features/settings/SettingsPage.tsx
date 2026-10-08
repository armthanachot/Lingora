import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { User } from '../users';
import { userApi } from '../users';
import { LessonBuilder } from './LessonBuilder';
import { VocabularyBuilder } from '../vocabulary/VocabularyBuilder';
import { SettingsDialog } from '../../components/SettingsDialog';
import { moveItem, replaceGroupOrder } from './reorder';
import { useDragReorder } from './useDragReorder';
import {
  settingsApi,
  type MasterField,
  type MasterReferenceOption,
  type MasterReferences,
  type MasterResource,
  type MasterRow,
} from './api';

type SettingsPageProps = {
  currentUser: User;
  onCurrentUserChange: (user: User) => void;
  onBack: () => void;
  themeControl?: ReactNode;
};

type SettingsMenu = 'users' | 'lesson-builder' | 'vocabulary' | MasterResource;
type ConfirmAction =
  | { type: 'save-row'; id: string }
  | { type: 'save-all' }
  | { type: 'delete'; id: string }
  | null;

type GuideStep = {
  menu: Exclude<SettingsMenu, 'users'>;
  section: 'Content setup' | 'Learner data';
  title: string;
  description: string;
  example: string;
  note?: string;
};

type TourPosition = {
  top: number;
  left: number;
  width: number;
  height: number;
  popoverTop: number;
  popoverLeft: number;
};

type MasterGroup = {
  id: string;
  label: string;
  description?: string;
  rows: MasterRow[];
};

const guideSteps: GuideStep[] = [
  {
    menu: 'languages',
    section: 'Content setup',
    title: 'Language',
    description: 'Create the language learners can study. Courses depend on a language.',
    example: 'Japanese · ja',
  },
  {
    menu: 'levels',
    section: 'Content setup',
    title: 'Level',
    description: 'Define Lingora learning levels once, then reuse them across courses and languages.',
    example: 'Beginner Level 1 · beginner-1',
  },
  {
    menu: 'countries',
    section: 'Content setup',
    title: 'Country',
    description: 'Create countries that appear on the globe before linking them to languages.',
    example: 'Japan · JP',
  },
  {
    menu: 'country-languages',
    section: 'Content setup',
    title: 'Country language',
    description: 'Connect a country to one or more languages so the globe knows what is spoken there.',
    example: 'Japan → Japanese · primary',
  },
  {
    menu: 'courses',
    section: 'Content setup',
    title: 'Course',
    description: 'Create a learning path for a language and level. A course contains ordered modules.',
    example: 'Japanese for Beginners · japanese-for-beginners',
    note: 'Use a lowercase slug with hyphens. Example: japanese-for-beginners.',
  },
  {
    menu: 'modules',
    section: 'Content setup',
    title: 'Module',
    description: 'Group related lessons inside a course and use sort order to control sequence.',
    example: 'Greetings & Introductions · sort 1',
  },
  {
    menu: 'lessons',
    section: 'Content setup',
    title: 'Lesson',
    description: 'Create the lesson container inside a module, then build its content from blocks.',
    example: 'Saying Hello · sort 1',
  },
  {
    menu: 'lesson-builder',
    section: 'Content setup',
    title: 'Lesson builder',
    description: 'Compose each lesson from reading, quiz, media, and conversation blocks.',
    example: 'Reading → Image → Multiple Choice → Conversation',
    note: 'Block IDs are automatic. Save content through the builder instead of the legacy lesson JSON field.',
  },
  {
    menu: 'enrollments',
    section: 'Learner data',
    title: 'Enrollment',
    description: 'Connect a learner to a course. This is normally created by the product flow.',
    example: 'Learner → Japanese for Beginners',
    note: 'Usually system-managed. Edit manually only for support or data correction.',
  },
  {
    menu: 'progress',
    section: 'Learner data',
    title: 'Progress',
    description: 'Track a learner’s status and completion for each lesson in an enrollment.',
    example: 'Enrollment → Saying Hello → 80%',
    note: 'Usually system-managed from learner activity.',
  },
];

const menuItems: Array<{ id: SettingsMenu; label: string; group: 'Account' | 'Master data' }> = [
  { id: 'users', label: 'Users', group: 'Account' },
  { id: 'languages', label: 'Languages', group: 'Master data' },
  { id: 'levels', label: 'Levels', group: 'Master data' },
  { id: 'countries', label: 'Countries', group: 'Master data' },
  { id: 'country-languages', label: 'Country languages', group: 'Master data' },
  { id: 'courses', label: 'Courses', group: 'Master data' },
  { id: 'modules', label: 'Modules', group: 'Master data' },
  { id: 'lessons', label: 'Lessons', group: 'Master data' },
  { id: 'lesson-builder', label: 'Lesson builder', group: 'Master data' },
  { id: 'vocabulary', label: 'Vocabulary', group: 'Master data' },
  { id: 'enrollments', label: 'Enrollments', group: 'Master data' },
  { id: 'progress', label: 'Progress', group: 'Master data' },
];

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    const text = JSON.stringify(value);
    return text.length > 80 ? `${text.slice(0, 77)}…` : text;
  }
  const text = String(value);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

function humanize(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/^./, (character) => character.toUpperCase());
}

function fieldLabel(field: MasterField) {
  return field.reference?.label ?? humanize(field.name);
}

function referenceDisplayValue(field: MasterField, value: unknown, references: MasterReferences) {
  if (!field.reference) return formatValue(value);
  if (value === null || value === undefined || value === '') return '—';

  const option = (references[field.name] ?? []).find((item) => item.id === String(value));
  return option?.label ?? 'Unavailable reference';
}

function dateInputValue(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function editorValue(field: MasterField, value: unknown): unknown {
  if (field.kind === 'boolean') return Boolean(value);
  if (field.kind === 'date') return dateInputValue(value);
  if (field.kind === 'json') {
    if (value === null || value === undefined) return '';
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  return value ?? '';
}

function createDefaultValues(fields: MasterField[]) {
  return Object.fromEntries(
    fields
      .filter((field) => field.creatable)
      .map((field) => [
        field.name,
        field.defaultValue !== undefined
          ? field.defaultValue
          : field.kind === 'boolean'
            ? false
            : '',
      ]),
  );
}

function rowDraft(row: MasterRow, fields: MasterField[]) {
  return Object.fromEntries(fields.map((field) => [field.name, editorValue(field, row[field.name])]));
}

function draftMap(rows: MasterRow[], fields: MasterField[]) {
  const output: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    if (row.id) output[row.id] = rowDraft(row, fields);
  }
  return output;
}

function comparable(field: MasterField, value: unknown) {
  const normalized = editorValue(field, value);
  if (field.kind === 'boolean') return normalized ? 'true' : 'false';
  return String(normalized ?? '');
}

function isDirty(row: MasterRow, draft: Record<string, unknown>, fields: MasterField[]) {
  return fields
    .filter((field) => field.editable)
    .some((field) => comparable(field, row[field.name]) !== comparable(field, draft[field.name]));
}

function apiValue(field: MasterField, value: unknown) {
  if (field.kind === 'date' && value) {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return value;
}

function editableValues(draft: Record<string, unknown>, fields: MasterField[]) {
  return Object.fromEntries(
    fields.filter((field) => field.editable).map((field) => [field.name, apiValue(field, draft[field.name])]),
  );
}

function ReferenceAutocomplete({
  field,
  value,
  options,
  onChange,
}: {
  field: MasterField;
  value: unknown;
  options: MasterReferenceOption[];
  onChange: (value: unknown) => void;
}) {
  const selectedId = value ? String(value) : '';
  const selectedOption = options.find((option) => option.id === selectedId);
  const [query, setQuery] = useState(selectedOption?.label ?? (selectedId ? 'Unavailable reference' : ''));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery(selectedOption?.label ?? (selectedId ? 'Unavailable reference' : ''));
  }, [selectedId, selectedOption?.label]);

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    const updateMenuPosition = () => {
      const input = inputRef.current;
      if (!input) return;

      const rect = input.getBoundingClientRect();
      const gap = 6;
      const viewportPadding = 12;
      const desiredWidth = Math.max(rect.width, 270);
      const width = Math.min(desiredWidth, window.innerWidth - viewportPadding * 2);
      const left = Math.max(
        viewportPadding,
        Math.min(rect.left, window.innerWidth - width - viewportPadding),
      );

      const roomBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
      const roomAbove = rect.top - gap - viewportPadding;
      const placeBelow = roomBelow >= 140 || roomBelow >= roomAbove;
      const availableHeight = Math.max(96, placeBelow ? roomBelow : roomAbove);
      const maxHeight = Math.min(250, availableHeight);
      const top = placeBelow
        ? rect.bottom + gap
        : Math.max(viewportPadding, rect.top - gap - maxHeight);

      setMenuPosition({ top, left, width, maxHeight });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const effectiveQuery = query === selectedOption?.label ? '' : normalizedQuery;
  const filteredOptions = options
    .filter((option) => {
      if (!effectiveQuery) return true;
      const haystack = `${option.label} ${option.description ?? ''}`.toLocaleLowerCase();
      return haystack.includes(effectiveQuery);
    })
    .slice(0, 40);

  function choose(option: MasterReferenceOption) {
    onChange(option.id);
    setQuery(option.label);
    setOpen(false);
    setActiveIndex(0);
  }

  return (
    <div
      className="master-reference"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setQuery(selectedOption?.label ?? (selectedId ? 'Unavailable reference' : ''));
        }
      }}
    >
      <div className={'master-reference-input-wrap' + (open ? ' is-open' : '')}>
        <input
          ref={inputRef}
          className="master-cell-input master-reference-input"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-label={fieldLabel(field)}
          autoComplete="off"
          value={query}
          placeholder={options.length > 0 ? `Search ${field.reference?.label.toLocaleLowerCase() ?? 'reference'}…` : 'No options available'}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.min(index + 1, Math.max(0, filteredOptions.length - 1)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.max(0, index - 1));
            } else if (event.key === 'Enter' && open && filteredOptions[activeIndex]) {
              event.preventDefault();
              choose(filteredOptions[activeIndex]);
            } else if (event.key === 'Escape' && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              setQuery(selectedOption?.label ?? '');
            }
          }}
        />
        <span className="master-reference-chevron" aria-hidden="true">⌄</span>
      </div>

      {open && menuPosition && createPortal(
        <div
          className="master-reference-menu master-reference-menu-portal"
          role="listbox"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
          }}
          onMouseDown={(event) => event.preventDefault()}
        >
          {filteredOptions.length > 0 ? filteredOptions.map((option, index) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === selectedId}
              className={(option.id === selectedId ? 'is-selected ' : '') + (index === activeIndex ? 'is-active' : '')}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(option)}
            >
              <span>
                <strong>{option.label}</strong>
                {option.description && <small>{option.description}</small>}
              </span>
              {option.id === selectedId && <span className="master-reference-check" aria-hidden="true">✓</span>}
            </button>
          )) : (
            <div className="master-reference-empty">
              {options.length === 0
                ? `No ${field.reference?.label.toLocaleLowerCase() ?? 'reference'} records yet. Create one first.`
                : 'No matching results.'}
            </div>
          )}
        </div>,
        inputRef.current?.closest('dialog') ?? document.body,
      )}
    </div>
  );
}

function MasterInput({
  field,
  value,
  referenceOptions = [],
  onChange,
}: {
  field: MasterField;
  value: unknown;
  referenceOptions?: MasterReferenceOption[];
  onChange: (value: unknown) => void;
}) {
  if (field.reference) {
    return <ReferenceAutocomplete field={field} value={value} options={referenceOptions} onChange={onChange} />;
  }

  if (field.kind === 'boolean') {
    return (
      <button
        className={'master-switch' + (Boolean(value) ? ' is-on' : '')}
        type="button"
        role="switch"
        aria-checked={Boolean(value)}
        aria-label={fieldLabel(field)}
        onClick={() => onChange(!Boolean(value))}
      >
        <span className="master-switch-thumb" />
      </button>
    );
  }

  if (field.kind === 'json') {
    return (
      <textarea
        className="master-cell-input master-json-input"
        aria-label={fieldLabel(field)}
        value={String(value ?? '')}
        onChange={(event) => onChange(event.target.value)}
        rows={1}
        spellCheck={false}
      />
    );
  }

  return (
    <input
      className="master-cell-input"
      aria-label={fieldLabel(field)}
      type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'datetime-local' : 'text'}
      step={field.kind === 'number' ? 'any' : undefined}
      value={String(value ?? '')}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function SettingsPage({ currentUser, onCurrentUserChange, onBack, themeControl }: SettingsPageProps) {
  const [activeMenu, setActiveMenu] = useState<SettingsMenu>('users');
  const [vocabularyDirty, setVocabularyDirty] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [masterRows, setMasterRows] = useState<MasterRow[]>([]);
  const [masterFields, setMasterFields] = useState<MasterField[]>([]);
  const [masterReferences, setMasterReferences] = useState<MasterReferences>({});
  const [masterDrafts, setMasterDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const [dirtyRows, setDirtyRows] = useState<Record<string, boolean>>({});
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createValues, setCreateValues] = useState<Record<string, unknown>>({});
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [tourPosition, setTourPosition] = useState<TourPosition | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const reorderPending = useRef(false);
  const currentMenu = useRef(activeMenu);
  currentMenu.current = activeMenu;
  const currentDrafts = useRef(masterDrafts);
  currentDrafts.current = masterDrafts;
  const sortable = masterFields.some(field => field.name === 'sortOrder' && field.editable);
  const drag = useDragReorder((from, to) => void reorderMasterRows(from, to), busy || loading);
  const [reorderStatus, setReorderStatus] = useState('');

  useEffect(() => {
    if (tourStep === null) {
      setTourPosition(null);
      return;
    }

    const step = guideSteps[tourStep];
    setActiveMenu(step.menu);

    const target = document.querySelector<HTMLElement>(`[data-guide-target="${step.menu}"]`);
    if (!target) return;

    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    const updatePosition = () => {
      const rect = target.getBoundingClientRect();
      const cardWidth = Math.min(350, window.innerWidth - 32);
      const cardHeight = 330;
      const roomOnRight = window.innerWidth - rect.right;
      const placeRight = roomOnRight >= cardWidth + 28;

      const popoverLeft = placeRight
        ? Math.min(window.innerWidth - cardWidth - 16, rect.right + 18)
        : Math.max(16, Math.min(rect.left, window.innerWidth - cardWidth - 16));

      const popoverTop = placeRight
        ? Math.max(16, Math.min(rect.top - 10, window.innerHeight - cardHeight - 16))
        : Math.max(16, Math.min(rect.bottom + 14, window.innerHeight - cardHeight - 16));

      setTourPosition({
        top: rect.top - 5,
        left: rect.left - 5,
        width: rect.width + 10,
        height: rect.height + 10,
        popoverTop,
        popoverLeft,
      });
    };

    const animationFrame = window.requestAnimationFrame(updatePosition);
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTourStep(null);
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('keydown', closeFromEscape);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('keydown', closeFromEscape);
    };
  }, [tourStep]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setCreateOpen(false);
    setConfirmAction(null);
    setDirtyRows({});
    setExpandedGroups({});
    setReorderStatus('');

    const request = activeMenu === 'users'
      ? userApi.list().then((rows) => {
          if (cancelled) return;
          setUsers(rows);
          setDraftNames(Object.fromEntries(rows.map((user) => [user.id, user.displayName ?? ''])));
          setMasterRows([]);
          setMasterFields([]);
          setMasterReferences({});
          setMasterDrafts({});
        })
      : (activeMenu === 'lesson-builder' || activeMenu === 'vocabulary')
        ? Promise.resolve().then(() => {
            if (cancelled) return;
            setUsers([]);
            setMasterRows([]);
            setMasterFields([]);
            setMasterReferences({});
            setMasterDrafts({});
          })
        : settingsApi.listMaster(activeMenu).then(({ rows, fields, references }) => {
            if (cancelled) return;
            setMasterRows(rows);
            setMasterFields(fields);
            setMasterReferences(references);
            setMasterDrafts(draftMap(rows, fields));
            setCreateValues(createDefaultValues(fields));
            setUsers([]);
          });

    void request
      .catch((requestError: unknown) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : String(requestError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeMenu]);

  const dirtyIds = useMemo(() => Object.keys(dirtyRows).filter((id) => dirtyRows[id]), [dirtyRows]);
  const activeLabel = menuItems.find((item) => item.id === activeMenu)?.label ?? activeMenu;
  const createLabel = guideSteps.find((step) => step.menu === activeMenu)?.title ?? activeLabel;
  const groupFieldName = activeMenu === 'modules'
    ? 'courseId'
    : activeMenu === 'lessons'
      ? 'moduleId'
      : null;
  const masterGroups = useMemo<MasterGroup[]>(() => {
    if (!groupFieldName) return [];

    const options = masterReferences[groupFieldName] ?? [];
    const rowsByGroup = new Map<string, MasterRow[]>();
    for (const row of masterRows) {
      const groupId = row[groupFieldName] ? String(row[groupFieldName]) : '__ungrouped__';
      const rows = rowsByGroup.get(groupId) ?? [];
      rows.push(row);
      rowsByGroup.set(groupId, rows);
    }

    const groups: MasterGroup[] = options.map((option) => ({
      id: option.id,
      label: option.label,
      description: option.description,
      rows: rowsByGroup.get(option.id) ?? [],
    }));

    const knownIds = new Set(options.map((option) => option.id));
    for (const [groupId, rows] of rowsByGroup) {
      if (knownIds.has(groupId)) continue;
      groups.push({
        id: groupId,
        label: groupId === '__ungrouped__' ? 'No parent assigned' : 'Unavailable parent',
        rows,
      });
    }

    return groups;
  }, [groupFieldName, masterReferences, masterRows]);

  function toggleGroup(groupId: string) {
    setExpandedGroups((groups) => ({ ...groups, [groupId]: !groups[groupId] }));
  }

  function setAllGroups(expanded: boolean) {
    setExpandedGroups(
      expanded
        ? Object.fromEntries(masterGroups.map((group) => [group.id, true]))
        : {},
    );
  }

  function openCreateForGroup(groupId: string) {
    if (!groupFieldName || groupId === '__ungrouped__') return;
    setCreateValues({
      ...createDefaultValues(masterFields),
      [groupFieldName]: groupId,
    });
    setCreateOpen(true);
  }

  async function saveDisplayName(user: User) {
    const displayName = (draftNames[user.id] ?? '').trim();
    if (displayName.length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }

    setSavingUserId(user.id);
    setError('');
    try {
      const updated = await userApi.update(user.id, { displayName });
      setUsers((rows) => rows.map((row) => row.id === updated.id ? updated : row));
      if (updated.id === currentUser.id) onCurrentUserChange(updated);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setSavingUserId(null);
    }
  }

  async function toggleSuperAdmin(user: User) {
    setSavingUserId(user.id);
    setError('');
    try {
      const updated = await userApi.update(user.id, { isSuperAdmin: !user.isSuperAdmin });
      setUsers((rows) => rows.map((row) => row.id === updated.id ? updated : row));
      if (updated.id === currentUser.id) onCurrentUserChange(updated);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setSavingUserId(null);
    }
  }

  function updateMasterDraft(row: MasterRow, field: MasterField, value: unknown) {
    const id = row.id;
    if (!id) return;
    const nextRowDraft = { ...(masterDrafts[id] ?? rowDraft(row, masterFields)), [field.name]: value };
    setMasterDrafts((drafts) => ({ ...drafts, [id]: nextRowDraft }));
    setDirtyRows((dirty) => ({ ...dirty, [id]: isDirty(row, nextRowDraft, masterFields) }));
  }

  async function reorderMasterRows(sourceId: string, targetId: string) {
    if (!sortable || busy || reorderPending.current || activeMenu === 'users' || (activeMenu === 'lesson-builder' || activeMenu === 'vocabulary')) return;
    const source = masterRows.find(row => row.id === sourceId);
    const target = masterRows.find(row => row.id === targetId);
    if (!source || !target || (groupFieldName && source[groupFieldName] !== target[groupFieldName])) return;
    const group = groupFieldName ? masterRows.filter(row => row[groupFieldName] === source[groupFieldName]) : masterRows;
    const reordered = moveItem(group, sourceId, targetId);
    if (reordered === group) return;
    const resource = activeMenu;
    const previous = masterRows;
    const ordered = reordered.map((row, index) => ({ ...row, sortOrder: index + 1 }));
    const next = replaceGroupOrder(masterRows, ordered);
    reorderPending.current = true;
    setBusy(true);
    setError('');
    setReorderStatus('Saving order…');
    setMasterRows(next);
    try {
      const { rows: saved } = await settingsApi.batchUpdateMaster(resource,
        ordered.flatMap(row => row.id ? [{ id: row.id, values: { sortOrder: row.sortOrder } }] : []));
      if (currentMenu.current !== resource) return;
      const savedById = new Map(saved.map(row => [row.id, row]));
      setMasterRows(next.map(row => savedById.get(row.id) ?? row));
      // Reordering saves only sortOrder. Keep all other unsaved cell values intact.
      const drafts = { ...currentDrafts.current };
      const dirty = { ...dirtyRows };
      for (const row of saved) {
        if (!row.id) continue;
        drafts[row.id] = { ...(drafts[row.id] ?? rowDraft(row, masterFields)), sortOrder: row.sortOrder };
        dirty[row.id] = isDirty(row, drafts[row.id], masterFields);
      }
      setMasterDrafts(drafts);
      setDirtyRows(dirty);
      setReorderStatus('Order saved.');
    } catch (requestError) {
      if (currentMenu.current !== resource) return;
      setMasterRows(previous);
      setReorderStatus('');
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      reorderPending.current = false;
      setBusy(false);
    }
  }

  function applySavedRows(savedRows: MasterRow[]) {
    const savedById = new Map<string, MasterRow>();
    for (const row of savedRows) if (row.id) savedById.set(row.id, row);

    if (groupFieldName) {
      const currentById = new Map(masterRows.flatMap((row) => row.id ? [[row.id, row] as const] : []));
      const movedGroupIds = savedRows.flatMap((row) => {
        if (!row.id || !row[groupFieldName]) return [];
        const previous = currentById.get(row.id);
        const previousGroupId = previous?.[groupFieldName] ? String(previous[groupFieldName]) : '';
        const nextGroupId = String(row[groupFieldName]);
        return previousGroupId !== nextGroupId ? [nextGroupId] : [];
      });
      if (movedGroupIds.length > 0) {
        setExpandedGroups((groups) => ({
          ...groups,
          ...Object.fromEntries(movedGroupIds.map((groupId) => [groupId, true])),
        }));
      }
    }

    setMasterRows((rows) => rows.map((row) => row.id && savedById.has(row.id) ? savedById.get(row.id)! : row));
    setMasterDrafts((drafts) => {
      const next = { ...drafts };
      for (const row of savedRows) if (row.id) next[row.id] = rowDraft(row, masterFields);
      return next;
    });
    setDirtyRows((dirty) => {
      const next = { ...dirty };
      for (const row of savedRows) if (row.id) delete next[row.id];
      return next;
    });
  }

  async function saveMasterRow(id: string) {
    if (activeMenu === 'users' || (activeMenu === 'lesson-builder' || activeMenu === 'vocabulary')) return;
    const draft = masterDrafts[id];
    if (!draft) return;
    const { row } = await settingsApi.updateMaster(activeMenu, id, editableValues(draft, masterFields));
    applySavedRows([row]);
  }

  async function saveAllMasterRows() {
    if (activeMenu === 'users' || (activeMenu === 'lesson-builder' || activeMenu === 'vocabulary') || dirtyIds.length === 0) return;
    const changes = dirtyIds.flatMap((id) => {
      const draft = masterDrafts[id];
      return draft ? [{ id, values: editableValues(draft, masterFields) }] : [];
    });
    const { rows } = await settingsApi.batchUpdateMaster(activeMenu, changes);
    applySavedRows(rows);
  }

  async function deleteMasterRow(id: string) {
    if (activeMenu === 'users' || (activeMenu === 'lesson-builder' || activeMenu === 'vocabulary')) return;
    await settingsApi.deleteMaster(activeMenu, id);
    setMasterRows((rows) => rows.filter((row) => row.id !== id));
    setMasterDrafts((drafts) => {
      const next = { ...drafts };
      delete next[id];
      return next;
    });
    setDirtyRows((dirty) => {
      const next = { ...dirty };
      delete next[id];
      return next;
    });
  }

  async function handleConfirmedAction() {
    const action = confirmAction;
    if (!action) return;
    setBusy(true);
    setError('');
    try {
      if (action.type === 'save-row') await saveMasterRow(action.id);
      if (action.type === 'save-all') await saveAllMasterRows();
      if (action.type === 'delete') await deleteMasterRow(action.id);
      setConfirmAction(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
      setConfirmAction(null);
    } finally {
      setBusy(false);
    }
  }

  async function createMasterRow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeMenu === 'users' || (activeMenu === 'lesson-builder' || activeMenu === 'vocabulary')) return;
    setBusy(true);
    setError('');
    try {
      const values = Object.fromEntries(
        masterFields
          .filter((field) => field.creatable)
          .map((field) => [field.name, apiValue(field, createValues[field.name])]),
      );
      const { row } = await settingsApi.createMaster(activeMenu, values);
      setMasterRows((rows) => [...rows, row]);
      if (row.id) setMasterDrafts((drafts) => ({ ...drafts, [row.id!]: rowDraft(row, masterFields) }));
      if (groupFieldName && row[groupFieldName]) {
        const groupId = String(row[groupFieldName]);
        setExpandedGroups((groups) => ({ ...groups, [groupId]: true }));
      }
      setCreateValues(createDefaultValues(masterFields));
      setCreateOpen(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setBusy(false);
    }
  }

  const confirmText = confirmAction?.type === 'save-all'
    ? `Save changes to ${dirtyIds.length} row${dirtyIds.length === 1 ? '' : 's'}?`
    : confirmAction?.type === 'save-row'
      ? 'Save changes to this row?'
      : 'Soft delete this record? It will disappear from normal application data.';

  function renderMasterTable(rows: MasterRow[]) {
    if (rows.length === 0) {
      return <div className="settings-empty master-group-empty">No records in this group yet.</div>;
    }

    return (
      <div className="settings-table-wrap master-group-table-wrap">
        <table className="settings-table master-editor-table">
          <thead>
            <tr>
              {sortable && <th className="master-reorder-column" aria-label="Reorder" />}
              {masterFields.map((field) => <th key={field.name}>{fieldLabel(field)}</th>)}
              <th className="master-actions-column" aria-label="Row actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const id = row.id ?? String(index);
              const draft = masterDrafts[id] ?? rowDraft(row, masterFields);
              const dirty = Boolean(dirtyRows[id]);
              return (
                <tr key={id} {...(sortable ? drag.rowProps(id, groupFieldName ? String(row[groupFieldName]) : activeMenu) : {})}
                  className={(dirty ? 'is-dirty ' : '') + (drag.draggingId === id ? 'is-dragging ' : '') + (drag.targetId === id ? 'is-drop-target' : '')}>
                  {sortable && <td className="master-reorder-column">{drag.handle(id,
                    groupFieldName ? String(row[groupFieldName]) : activeMenu,
                    String(row.title ?? row.name ?? row.id), rows.flatMap(item => item.id ? [item.id] : []))}</td>}
                  {masterFields.map((field) => (
                    <td key={field.name}>
                      {field.editable ? (
                        <MasterInput
                          field={field}
                          value={draft[field.name]}
                          referenceOptions={masterReferences[field.name] ?? []}
                          onChange={(value) => { if (!reorderPending.current) updateMasterDraft(row, field, value); }}
                        />
                      ) : (
                        <span
                          className="master-readonly"
                          title={field.reference
                            ? referenceDisplayValue(field, row[field.name], masterReferences)
                            : String(row[field.name] ?? '')}
                        >
                          {referenceDisplayValue(field, row[field.name], masterReferences)}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="master-row-actions">
                    <button
                      className="master-row-save"
                      type="button"
                      aria-label="Save row"
                      title="Save row"
                      disabled={!dirty || busy || !row.id}
                      onClick={() => row.id && setConfirmAction({ type: 'save-row', id: row.id })}
                    >
                      ✓
                    </button>
                    <button
                      className="master-row-delete"
                      type="button"
                      aria-label="Delete row"
                      title="Soft delete"
                      disabled={busy || !row.id}
                      onClick={() => row.id && setConfirmAction({ type: 'delete', id: row.id })}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 12H7.7L7 9Zm3 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <aside className="settings-sidebar">
        <button className="settings-back" type="button" onClick={() => { if (!vocabularyDirty || window.confirm('Discard unsaved vocabulary changes?')) onBack(); }}>← Back to globe</button>
        <div className="settings-brand">Lingora <span>Settings</span></div>
        {(['Account', 'Master data'] as const).map((group) => (
          <div className="settings-menu-group" key={group}>
            <span>{group}</span>
            {menuItems.filter((item) => item.group === group).map((item) => (
              <button
                key={item.id}
                type="button"
                data-guide-target={item.id}
                className={activeMenu === item.id ? 'is-active' : ''}
                onClick={() => { if (item.id === activeMenu || !vocabularyDirty || window.confirm('Discard unsaved vocabulary changes?')) setActiveMenu(item.id); }}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </aside>

      <main className={'settings-content' + ((activeMenu === 'lesson-builder' || activeMenu === 'vocabulary') ? ' is-builder' : '')}>
        <header className="settings-header">
          <div><span className="auth-eyebrow">Super admin</span><h1>{activeLabel}</h1></div>
          <div className="settings-header-tools">
            {themeControl}
            <div className="settings-admin-chip">{currentUser.displayName ?? currentUser.email}</div>
          </div>
        </header>

        <section className={'settings-guide' + (guideOpen ? ' is-open' : ' is-collapsed')} aria-labelledby="settings-guide-title">
          <div className="settings-guide-heading">
            <div>
              <span className="settings-guide-eyebrow">Admin guide</span>
              <h2 id="settings-guide-title">Content setup guide</h2>
              <p>{guideOpen ? 'Set up Lingora from the foundation upward. Click any step to jump to that table, or run the guided tour.' : 'Open the setup map when you need it, or jump straight into the guided tour.'}</p>
            </div>
            <div className="settings-guide-heading-actions">
              <button
                className="settings-guide-toggle-button"
                type="button"
                aria-expanded={guideOpen}
                aria-controls="settings-guide-details"
                onClick={() => setGuideOpen((open) => !open)}
              >
                {guideOpen ? 'Hide guide' : 'Open guide'}
              </button>
              <button className="settings-guide-tour-button" type="button" onClick={() => setTourStep(0)}>
                <span aria-hidden="true">▶</span>
                Start guided tour
              </button>
            </div>
          </div>

          {guideOpen && (
            <div id="settings-guide-details">
              <div className="settings-guide-track">
                <div className="settings-guide-section">
                  <div className="settings-guide-section-label">
                    <span>01</span>
                    <strong>Content setup</strong>
                    <small>Create and publish learning content</small>
                  </div>
                  <div className="settings-guide-steps">
                    {guideSteps.filter((step) => step.section === 'Content setup').map((step, index, steps) => (
                      <div className="settings-guide-step-wrap" key={step.menu}>
                        <button
                          className={'settings-guide-step' + (activeMenu === step.menu ? ' is-active' : '')}
                          type="button"
                          onClick={() => setActiveMenu(step.menu)}
                        >
                          <span className="settings-guide-step-index">{index + 1}</span>
                          <span className="settings-guide-step-copy">
                            <strong>{step.title}</strong>
                            <small>{step.example}</small>
                          </span>
                        </button>
                        {index < steps.length - 1 && <span className="settings-guide-connector" aria-hidden="true">→</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="settings-guide-divider" />

                <div className="settings-guide-section is-learner-data">
                  <div className="settings-guide-section-label">
                    <span>02</span>
                    <strong>Learner data</strong>
                    <small>Mostly created by product activity</small>
                  </div>
                  <div className="settings-guide-steps">
                    {guideSteps.filter((step) => step.section === 'Learner data').map((step, index, steps) => (
                      <div className="settings-guide-step-wrap" key={step.menu}>
                        <button
                          className={'settings-guide-step' + (activeMenu === step.menu ? ' is-active' : '')}
                          type="button"
                          onClick={() => setActiveMenu(step.menu)}
                        >
                          <span className="settings-guide-step-index">{index + 9}</span>
                          <span className="settings-guide-step-copy">
                            <strong>{step.title}</strong>
                            <small>{step.example}</small>
                          </span>
                        </button>
                        {index < steps.length - 1 && <span className="settings-guide-connector" aria-hidden="true">→</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {activeMenu !== 'users' && (() => {
                const currentGuide = guideSteps.find((step) => step.menu === activeMenu);
                return currentGuide ? (
                  <div className="settings-guide-context">
                    <span className="settings-guide-context-icon" aria-hidden="true">✦</span>
                    <div>
                      <strong>{currentGuide.title}</strong>
                      <p>{currentGuide.description}</p>
                      <small>Example: {currentGuide.example}</small>
                      {currentGuide.note && <small className="is-note">{currentGuide.note}</small>}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </section>

        {error && <div className="settings-error" role="alert">{error}</div>}
        {loading ? <div className="settings-loading">Loading…</div> : activeMenu === 'users' ? (
          <section className="settings-panel">
            <div className="settings-panel-heading">
              <div><h2>User management</h2><p>Edit display names and control super-admin access. Accounts are created through Google Sign-In.</p></div>
              <span>{users.length} users</span>
            </div>
            <div className="settings-table-wrap">
              <table className="settings-table user-settings-table">
                <thead><tr><th>User</th><th>Display name</th><th>Active</th><th>Super admin</th><th /></tr></thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td><div className="settings-user-cell">{user.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <div className="settings-user-fallback">{user.email.slice(0, 1).toUpperCase()}</div>}<div><strong>{user.email}</strong><small>{[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Google account'}</small></div></div></td>
                      <td><input value={draftNames[user.id] ?? ''} onChange={(event) => setDraftNames((draft) => ({ ...draft, [user.id]: event.target.value }))} /></td>
                      <td>{user.isActive ? 'Active' : 'Inactive'}</td>
                      <td><button className={`admin-toggle${user.isSuperAdmin ? ' is-on' : ''}`} type="button" onClick={() => void toggleSuperAdmin(user)} disabled={savingUserId === user.id} aria-pressed={user.isSuperAdmin}><span /></button></td>
                      <td><button className="settings-save" type="button" onClick={() => void saveDisplayName(user)} disabled={savingUserId === user.id}>Save</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (activeMenu === 'lesson-builder' || activeMenu === 'vocabulary') ? (
          activeMenu === 'vocabulary' ? <VocabularyBuilder onDirtyChange={setVocabularyDirty} /> : <LessonBuilder />
        ) : (
          <section className="settings-panel master-editor-panel">
            <div className="settings-panel-heading master-heading">
              <div>
                <h2>{activeLabel}</h2>
                <p>
                  {groupFieldName
                    ? `Grouped by ${activeMenu === 'modules' ? 'course' : 'module'}. Groups are collapsed by default so you can focus on one section at a time.`
                    : 'Inline edit master data. Primary keys and automatic timestamps are read-only.'}
                </p>
              </div>
              <div className="master-heading-actions">
                <span>{masterRows.length} records</span>
                {groupFieldName && masterGroups.length > 0 && (
                  <div className="master-group-bulk-actions">
                    <button type="button" onClick={() => setAllGroups(true)} disabled={busy}>Expand all</button>
                    <button type="button" onClick={() => setAllGroups(false)} disabled={busy}>Collapse all</button>
                  </div>
                )}
                <button className="master-save-all" type="button" disabled={dirtyIds.length === 0 || busy} onClick={() => setConfirmAction({ type: 'save-all' })}>✓ Save all changes{dirtyIds.length > 0 ? ` (${dirtyIds.length})` : ''}</button>
                <button
                  className="master-create"
                  type="button"
                  onClick={() => {
                    setCreateValues(createDefaultValues(masterFields));
                    setCreateOpen(true);
                  }}
                  disabled={busy}
                >
                  + Create
                </button>
              </div>
            </div>

            {sortable && <p className="master-reorder-hint">Drag the ⋮⋮ handle to reorder{groupFieldName ? ' within this group' : ''}. Order saves automatically. <span role="status">{reorderStatus}</span></p>}
            {groupFieldName ? (
              masterGroups.length === 0 ? (
                <div className="settings-empty">No parent records available yet. Create the parent data first.</div>
              ) : (
                <div className="master-accordion-list">
                  {masterGroups.map((group) => {
                    const expanded = Boolean(expandedGroups[group.id]);
                    const dirtyCount = group.rows.filter((row) => row.id && dirtyRows[row.id]).length;
                    const noun = activeMenu === 'modules' ? 'module' : 'lesson';
                    return (
                      <section className={'master-accordion-group' + (expanded ? ' is-open' : '')} key={group.id}>
                        <div className="master-accordion-header">
                          <button
                            className="master-accordion-toggle"
                            type="button"
                            aria-expanded={expanded}
                            onClick={() => toggleGroup(group.id)}
                          >
                            <span className="master-accordion-chevron" aria-hidden="true">›</span>
                            <span className="master-accordion-copy">
                              <strong>{group.label}</strong>
                              {group.description && <small>{group.description}</small>}
                            </span>
                            {dirtyCount > 0 && (
                              <span className="master-accordion-unsaved">{dirtyCount} unsaved</span>
                            )}
                            <span className="master-accordion-count">
                              {group.rows.length} {noun}{group.rows.length === 1 ? '' : 's'}
                            </span>
                          </button>
                          {group.id !== '__ungrouped__' && (
                            <button
                              className="master-accordion-add"
                              type="button"
                              disabled={busy}
                              onClick={() => openCreateForGroup(group.id)}
                            >
                              + Add
                            </button>
                          )}
                        </div>
                        {expanded && (
                          <div className="master-accordion-body">
                            {renderMasterTable(group.rows)}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )
            ) : (
              masterRows.length === 0
                ? <div className="settings-empty">No records yet. Use Create to add the first one.</div>
                : renderMasterTable(masterRows)
            )}
          </section>
        )}
      </main>

      {tourStep !== null && tourPosition && (() => {
        const step = guideSteps[tourStep];
        const isLast = tourStep === guideSteps.length - 1;
        return (
          <>
            <div className="settings-tour-overlay" aria-hidden="true" />
            <div
              className="settings-tour-highlight"
              style={{
                top: tourPosition.top,
                left: tourPosition.left,
                width: tourPosition.width,
                height: tourPosition.height,
              }}
              aria-hidden="true"
            />
            <section
              className="settings-tour-popover"
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-tour-title"
              style={{ top: tourPosition.popoverTop, left: tourPosition.popoverLeft }}
            >
              <div className="settings-tour-progress">
                <span>{step.section}</span>
                <strong>{tourStep + 1} / {guideSteps.length}</strong>
              </div>
              <h2 id="settings-tour-title">{step.title}</h2>
              <p>{step.description}</p>
              <div className="settings-tour-example">
                <span>Example</span>
                <strong>{step.example}</strong>
              </div>
              {step.note && <div className="settings-tour-note">{step.note}</div>}
              <div className="settings-tour-actions">
                <button className="settings-tour-skip" type="button" onClick={() => setTourStep(null)}>Skip tour</button>
                <div>
                  <button
                    type="button"
                    className="settings-tour-secondary"
                    disabled={tourStep === 0}
                    onClick={() => setTourStep((current) => current === null ? null : Math.max(0, current - 1))}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="settings-tour-primary"
                    onClick={() => setTourStep((current) => current === null || isLast ? null : current + 1)}
                  >
                    {isLast ? 'Finish' : 'Next'}
                  </button>
                </div>
              </div>
            </section>
          </>
        );
      })()}

      {createOpen && activeMenu !== 'users' && activeMenu !== 'lesson-builder' && activeMenu !== 'vocabulary' && (
        <SettingsDialog className="master-create-modal" labelledBy="create-master-title" busy={busy} onClose={() => setCreateOpen(false)}>
            <div className="settings-modal-heading"><div><span className="auth-eyebrow">Create master data</span><h2 id="create-master-title">New {createLabel}</h2></div><button type="button" aria-label="Close" disabled={busy} onClick={() => setCreateOpen(false)}>×</button></div>
            <form onSubmit={(event) => void createMasterRow(event)}>
              <div className="master-create-grid">
                {masterFields.filter((field) => field.creatable).map((field) => (
                  <div className="master-create-field" key={field.name}>
                    <span>{fieldLabel(field)}{field.requiredOnCreate ? ' *' : ''}</span>
                    <MasterInput
                      field={field}
                      value={createValues[field.name]}
                      referenceOptions={masterReferences[field.name] ?? []}
                      onChange={(value) => setCreateValues((values) => ({ ...values, [field.name]: value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="settings-modal-actions"><button type="button" className="modal-secondary" onClick={() => setCreateOpen(false)} disabled={busy}>Cancel</button><button type="submit" className="modal-primary" disabled={busy}>{busy ? 'Creating…' : 'Create'}</button></div>
            </form>
        </SettingsDialog>
      )}

      {confirmAction && (
        <SettingsDialog className="confirm-modal" labelledBy="confirm-title" busy={busy} onClose={() => setConfirmAction(null)} alert>
            <div className={`confirm-icon${confirmAction.type === 'delete' ? ' is-danger' : ''}`}>{confirmAction.type === 'delete' ? '!' : '✓'}</div>
            <h2 id="confirm-title">Confirm action</h2><p>{confirmText}</p>
            <div className="settings-modal-actions"><button type="button" className="modal-secondary" autoFocus onClick={() => setConfirmAction(null)} disabled={busy}>Cancel</button><button type="button" className={confirmAction.type === 'delete' ? 'modal-danger' : 'modal-primary'} onClick={() => void handleConfirmedAction()} disabled={busy}>{busy ? 'Working…' : confirmAction.type === 'delete' ? 'Soft delete' : 'Save'}</button></div>
        </SettingsDialog>
      )}
    </div>
  );
}
