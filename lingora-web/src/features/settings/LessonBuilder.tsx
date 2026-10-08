import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { moveItem } from './reorder';
import { useDragReorder } from './useDragReorder';
import { ReadingEditor as MarkdownReadingEditor } from './ReadingEditor';
import {
  LESSON_BLOCK_TYPES,
  blockTypeDescriptions,
  blockTypeLabels,
  type BlockCompletionRule,
  type LessonBlock,
  type LessonBlockType,
  type MediaAsset,
} from '../lessons/blocks';
import {
  lessonBuilderApi,
  type LessonBuilderDetail,
  type LessonBuilderSummary,
  type LessonBuilderCountryLanguage,
} from './lessonBuilderApi';
import { buildLessonFilters, emptyLessonFilters, filterFields, type FilterKey } from './lessonBuilderFilters';

type BlockCardProps = {
  dragHandle: ReactNode;
  reorderBusy: boolean;
  block: LessonBlock;
  index: number;
  total: number;
  onSaved: (block: LessonBlock) => void;
  onMove: (blockId: string, direction: -1 | 1) => void;
  onDelete: (blockId: string) => void;
};

type Participant = {
  id: string;
  name: string;
  avatarUrl?: string;
};

type ConversationTurn = {
  id: string;
  speakerId: string;
  text: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function participantList(value: unknown): Participant[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const data = record(item);
    return typeof data.id === 'string'
      ? [{ id: data.id, name: stringValue(data.name), avatarUrl: stringValue(data.avatarUrl) || undefined }]
      : [];
  });
}

function turnList(value: unknown): ConversationTurn[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const data = record(item);
    return typeof data.id === 'string'
      ? [{
          id: data.id,
          speakerId: stringValue(data.speakerId),
          text: stringValue(data.text),
        }]
      : [];
  });
}

function choiceList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const data = record(item);
    return typeof data.id === 'string'
      ? [{ id: data.id, text: stringValue(data.text) }]
      : [];
  });
}

function MediaPreview({ media, kind }: { media: MediaAsset | null; kind: 'image' | 'audio' | 'video' }) {
  if (!media?.url) return <div className="lesson-media-empty">No media selected yet.</div>;
  if (kind === 'image') {
    return <img className="lesson-media-preview-image" src={media.url} alt="" />;
  }
  if (kind === 'audio') {
    return <audio className="lesson-media-preview-audio" src={media.url} controls preload="metadata" />;
  }
  return <video className="lesson-media-preview-video" src={media.url} controls preload="metadata" />;
}

function MediaEditor({
  value,
  kind,
  onChange,
}: {
  value: MediaAsset | null;
  kind: 'image' | 'audio' | 'video';
  onChange: (value: MediaAsset | null) => void;
}) {
  const [source, setSource] = useState<'upload' | 'url'>(value?.source ?? 'upload');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (value?.source) setSource(value.source);
  }, [value?.source]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const result = await lessonBuilderApi.uploadMedia(file);
      onChange(result.media);
      setSource('upload');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
    } finally {
      setUploading(false);
    }
  }

  const accept = kind === 'image' ? 'image/*' : kind === 'audio' ? 'audio/*' : 'video/*';

  return (
    <div className="lesson-media-editor">
      <div className="lesson-media-source-tabs" role="tablist" aria-label="Media source">
        <button
          type="button"
          className={source === 'upload' ? 'is-active' : ''}
          onClick={() => setSource('upload')}
        >
          Upload
        </button>
        <button
          type="button"
          className={source === 'url' ? 'is-active' : ''}
          onClick={() => setSource('url')}
        >
          External URL
        </button>
      </div>

      {source === 'upload' ? (
        <label className="lesson-media-upload">
          <span>{uploading ? 'Uploading…' : 'Choose file'}</span>
          <small>Image, audio, or video · max 50 MB</small>
          <input
            type="file"
            accept={accept}
            disabled={uploading}
            onChange={(event) => void upload(event.target.files?.[0])}
          />
        </label>
      ) : (
        <label className="lesson-builder-field">
          <span>Media URL</span>
          <input
            type="url"
            value={value?.source === 'url' ? value.url : ''}
            placeholder="https://…"
            onChange={(event) => onChange(event.target.value
              ? { source: 'url', url: event.target.value }
              : null)}
          />
        </label>
      )}

      {error && <div className="lesson-builder-inline-error">{error}</div>}
      <MediaPreview media={value} kind={kind} />
      {value?.source === 'upload' && value.originalName && (
        <small className="lesson-media-file-name">{value.originalName}</small>
      )}
    </div>
  );
}

function CompletionEditor({
  type,
  completion,
  onChange,
}: {
  type: LessonBlockType;
  completion: LessonBlock['completion'];
  onChange: (value: LessonBlock['completion']) => void;
}) {
  const options: BlockCompletionRule[] = type === 'multiple_choice'
    ? ['answered', 'correct', 'score']
    : ['viewed'];

  const rule = options.includes(completion.rule) ? completion.rule : options[0];

  return (
    <div className="lesson-builder-contract-row">
      <label className="lesson-builder-field">
        <span>Completion rule</span>
        <select
          value={rule}
          onChange={(event) => onChange({
            ...completion,
            rule: event.target.value as BlockCompletionRule,
          })}
        >
          {options.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      {rule === 'score' && (
        <label className="lesson-builder-field">
          <span>Minimum score</span>
          <input
            type="number"
            min="0"
            max="100"
            value={typeof completion.minimumScore === 'number' ? completion.minimumScore : 80}
            onChange={(event) => onChange({
              ...completion,
              rule,
              minimumScore: Number(event.target.value),
            })}
          />
        </label>
      )}
    </div>
  );
}

function ReadingEditor({
  content,
  settings,
  onContent,
  onSettings,
}: {
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  onContent: (content: Record<string, unknown>) => void;
  onSettings: (settings: Record<string, unknown>) => void;
}) {
  return (
    <>
      <label className="lesson-builder-field">
        <span>Title <small>optional</small></span>
        <input
          value={stringValue(content.title)}
          onChange={(event) => onContent({ ...content, title: event.target.value })}
          placeholder="A friendly heading"
        />
      </label>
      <MarkdownReadingEditor
        body={stringValue(content.body)}
        format={content.format}
        textSize={stringValue(settings.textSize)}
        alignment={stringValue(settings.alignment)}
        onChange={(body, format) => onContent({ ...content, body, format })}
      />
      <div className="lesson-builder-two-columns">
        <label className="lesson-builder-field">
          <span>Text size</span>
          <select
            value={stringValue(settings.textSize) || 'medium'}
            onChange={(event) => onSettings({ ...settings, textSize: event.target.value })}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </label>
        <label className="lesson-builder-field">
          <span>Alignment</span>
          <select
            value={stringValue(settings.alignment) || 'left'}
            onChange={(event) => onSettings({ ...settings, alignment: event.target.value })}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
          </select>
        </label>
      </div>
    </>
  );
}

function MultipleChoiceEditor({
  content,
  settings,
  onContent,
  onSettings,
}: {
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  onContent: (content: Record<string, unknown>) => void;
  onSettings: (settings: Record<string, unknown>) => void;
}) {
  const choices = choiceList(content.choices);
  const correctChoiceId = stringValue(content.correctChoiceId);

  function updateChoice(id: string, text: string) {
    onContent({
      ...content,
      choices: choices.map((choice) => choice.id === id ? { ...choice, text } : choice),
    });
  }

  function addChoice() {
    const id = 'choice_' + crypto.randomUUID();
    onContent({ ...content, choices: [...choices, { id, text: '' }] });
  }

  function removeChoice(id: string) {
    if (choices.length <= 2) return;
    const next = choices.filter((choice) => choice.id !== id);
    onContent({
      ...content,
      choices: next,
      correctChoiceId: correctChoiceId === id ? next[0]?.id ?? '' : correctChoiceId,
    });
  }

  return (
    <>
      <label className="lesson-builder-field">
        <span>Question</span>
        <textarea
          rows={3}
          value={stringValue(content.question)}
          onChange={(event) => onContent({ ...content, question: event.target.value })}
          placeholder="Ask the learner something…"
        />
      </label>

      <div className="lesson-choice-editor">
        <div className="lesson-builder-subheading">
          <span>Choices</span>
          <button type="button" onClick={addChoice}>+ Add choice</button>
        </div>
        {choices.map((choice, index) => (
          <div className="lesson-choice-row" key={choice.id}>
            <input
              type="radio"
              checked={correctChoiceId === choice.id}
              onChange={() => onContent({ ...content, correctChoiceId: choice.id })}
              aria-label={'Mark choice ' + (index + 1) + ' correct'}
            />
            <input
              value={choice.text}
              onChange={(event) => updateChoice(choice.id, event.target.value)}
              placeholder={'Choice ' + (index + 1)}
            />
            <button
              type="button"
              className="lesson-builder-icon-button"
              disabled={choices.length <= 2}
              onClick={() => removeChoice(choice.id)}
              aria-label="Remove choice"
            >
              ×
            </button>
          </div>
        ))}
        <small>Select the radio button beside the correct answer.</small>
      </div>

      <label className="lesson-builder-field">
        <span>Explanation <small>optional</small></span>
        <textarea
          rows={3}
          value={stringValue(content.explanation)}
          onChange={(event) => onContent({ ...content, explanation: event.target.value })}
          placeholder="Explain why the answer is correct…"
        />
      </label>

      <div className="lesson-builder-toggle-grid">
        {[
          ['shuffleChoices', 'Shuffle choices'],
          ['showExplanation', 'Show explanation'],
        ].map(([key, label]) => (
          <label className="lesson-builder-check" key={key}>
            <input
              type="checkbox"
              checked={booleanValue(settings[key], key !== 'shuffleChoices')}
              onChange={(event) => onSettings({ ...settings, [key]: event.target.checked })}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </>
  );
}

function MediaBlockEditor({
  type,
  content,
  settings,
  onContent,
  onSettings,
}: {
  type: 'image' | 'audio' | 'video';
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  onContent: (content: Record<string, unknown>) => void;
  onSettings: (settings: Record<string, unknown>) => void;
}) {
  const media = record(content.media);
  const mediaValue = typeof media.url === 'string' && (media.source === 'upload' || media.source === 'url')
    ? media as unknown as MediaAsset
    : null;

  return (
    <>
      <MediaEditor
        value={mediaValue}
        kind={type}
        onChange={(next) => onContent({ ...content, media: next })}
      />

      {type === 'image' ? (
        <>
          <label className="lesson-builder-field">
            <span>Alt text</span>
            <input
              value={stringValue(content.alt)}
              onChange={(event) => onContent({ ...content, alt: event.target.value })}
              placeholder="Describe the image for accessibility"
            />
          </label>
          <label className="lesson-builder-field">
            <span>Caption <small>optional</small></span>
            <input
              value={stringValue(content.caption)}
              onChange={(event) => onContent({ ...content, caption: event.target.value })}
            />
          </label>
          <label className="lesson-builder-field">
            <span>Image fit</span>
            <select
              value={stringValue(settings.fit) || 'contain'}
              onChange={(event) => onSettings({ ...settings, fit: event.target.value })}
            >
              <option value="contain">Contain</option>
              <option value="cover">Cover</option>
            </select>
          </label>
        </>
      ) : (
        <>
          <label className="lesson-builder-field">
            <span>Title <small>optional</small></span>
            <input
              value={stringValue(content.title)}
              onChange={(event) => onContent({ ...content, title: event.target.value })}
            />
          </label>
          <label className="lesson-builder-field">
            <span>{type === 'audio' ? 'Transcript' : 'Caption'} <small>optional</small></span>
            <textarea
              rows={4}
              value={stringValue(content[type === 'audio' ? 'transcript' : 'caption'])}
              onChange={(event) => onContent({
                ...content,
                [type === 'audio' ? 'transcript' : 'caption']: event.target.value,
              })}
            />
          </label>
          <div className="lesson-builder-toggle-grid">
            <label className="lesson-builder-check">
              <input
                type="checkbox"
                checked={booleanValue(settings.autoplay)}
                onChange={(event) => onSettings({ ...settings, autoplay: event.target.checked })}
              />
              <span>Autoplay</span>
            </label>
            <label className="lesson-builder-check">
              <input
                type="checkbox"
                checked={booleanValue(settings.controls, true)}
                onChange={(event) => onSettings({ ...settings, controls: event.target.checked })}
              />
              <span>Show controls</span>
            </label>
          </div>
        </>
      )}
    </>
  );
}

function ConversationEditor({
  content,
  settings,
  onContent,
  onSettings,
}: {
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  onContent: (content: Record<string, unknown>) => void;
  onSettings: (settings: Record<string, unknown>) => void;
}) {
  const participants = participantList(content.participants);
  const turns = turnList(content.turns);

  function updateParticipant(id: string, patch: Partial<Participant>) {
    onContent({
      ...content,
      participants: participants.map((participant) => participant.id === id
        ? { ...participant, ...patch }
        : participant),
    });
  }

  function addParticipant() {
    const id = 'speaker_' + crypto.randomUUID();
    onContent({
      ...content,
      participants: [...participants, { id, name: 'Speaker ' + (participants.length + 1) }],
    });
  }

  function removeParticipant(id: string) {
    if (participants.length <= 1) return;
    const nextParticipants = participants.filter((participant) => participant.id !== id);
    const fallbackSpeakerId = nextParticipants[0]?.id ?? '';
    onContent({
      ...content,
      participants: nextParticipants,
      turns: turns.map((turn) => turn.speakerId === id ? { ...turn, speakerId: fallbackSpeakerId } : turn),
    });
  }

  function addTurn() {
    onContent({
      ...content,
      turns: [
        ...turns,
        {
          id: 'turn_' + crypto.randomUUID(),
          speakerId: participants[0]?.id ?? '',
          text: '',
        },
      ],
    });
  }

  function updateTurn(id: string, patch: Partial<ConversationTurn>) {
    onContent({
      ...content,
      turns: turns.map((turn) => turn.id === id ? { ...turn, ...patch } : turn),
    });
  }

  function removeTurn(id: string) {
    onContent({ ...content, turns: turns.filter((turn) => turn.id !== id) });
  }

  return (
    <>
      <label className="lesson-builder-field">
        <span>Conversation title <small>optional</small></span>
        <input
          value={stringValue(content.title)}
          onChange={(event) => onContent({ ...content, title: event.target.value })}
        />
      </label>

      <div className="lesson-conversation-section">
        <div className="lesson-builder-subheading">
          <span>Participants</span>
          <button type="button" onClick={addParticipant}>+ Add person</button>
        </div>
        <div className="lesson-participant-grid">
          {participants.map((participant, index) => (
            <div className="lesson-participant-card" key={participant.id}>
              <div className="lesson-participant-number">{index + 1}</div>
              <label className="lesson-builder-field">
                <span>Name</span>
                <input
                  value={participant.name}
                  onChange={(event) => updateParticipant(participant.id, { name: event.target.value })}
                />
              </label>
              <label className="lesson-builder-field">
                <span>Avatar URL <small>optional</small></span>
                <input
                  type="url"
                  value={participant.avatarUrl ?? ''}
                  onChange={(event) => updateParticipant(participant.id, { avatarUrl: event.target.value })}
                />
              </label>
              <button
                type="button"
                className="lesson-builder-icon-button"
                disabled={participants.length <= 1}
                onClick={() => removeParticipant(participant.id)}
                aria-label="Remove participant"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="lesson-conversation-section">
        <div className="lesson-builder-subheading">
          <span>Conversation turns</span>
          <button type="button" onClick={addTurn}>+ Add turn</button>
        </div>
        {turns.length === 0 ? (
          <div className="lesson-builder-soft-empty">Add the first line of dialogue.</div>
        ) : (
          <div className="lesson-turn-list">
            {turns.map((turn, index) => (
              <div className="lesson-turn-row" key={turn.id}>
                <span className="lesson-turn-index">{index + 1}</span>
                <select
                  value={turn.speakerId}
                  onChange={(event) => updateTurn(turn.id, { speakerId: event.target.value })}
                >
                  {participants.map((participant) => (
                    <option value={participant.id} key={participant.id}>
                      {participant.name || 'Unnamed speaker'}
                    </option>
                  ))}
                </select>
                <textarea
                  rows={2}
                  value={turn.text}
                  onChange={(event) => updateTurn(turn.id, { text: event.target.value })}
                  placeholder="What does this person say?"
                />
                <button
                  type="button"
                  className="lesson-builder-icon-button"
                  onClick={() => removeTurn(turn.id)}
                  aria-label="Remove conversation turn"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="lesson-builder-two-columns">
        <label className="lesson-builder-field">
          <span>Layout</span>
          <select
            value={stringValue(settings.layout) || 'chat'}
            onChange={(event) => onSettings({ ...settings, layout: event.target.value })}
          >
            <option value="chat">Chat</option>
            <option value="script">Script</option>
          </select>
        </label>
        <label className="lesson-builder-check lesson-builder-check-boxed">
          <input
            type="checkbox"
            checked={booleanValue(settings.showSpeakerNames, true)}
            onChange={(event) => onSettings({ ...settings, showSpeakerNames: event.target.checked })}
          />
          <span>Show speaker names</span>
        </label>
      </div>
    </>
  );
}

function BlockCard({ block, index, total, onSaved, onMove, onDelete, dragHandle, reorderBusy }: BlockCardProps) {
  const [content, setContent] = useState<Record<string, unknown>>(() => record(block.content));
  const [settings, setSettings] = useState<Record<string, unknown>>(() => record(block.settings));
  const [interaction, setInteraction] = useState<LessonBlock['interaction']>(block.interaction);
  const [completion, setCompletion] = useState<LessonBlock['completion']>(block.completion);
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setContent(record(block.content));
    setSettings(record(block.settings));
    setInteraction(block.interaction);
    setCompletion(block.completion);
    setDirty(false);
  }, [block]);

  function changeContent(next: Record<string, unknown>) {
    setContent(next);
    setDirty(true);
  }

  function changeSettings(next: Record<string, unknown>) {
    setSettings(next);
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const { block: saved } = await lessonBuilderApi.updateBlock(block.lessonId, block.id, {
        version: block.version,
        content,
        settings,
        interaction,
        completion,
      });
      onSaved(saved);
      setDirty(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  }

  const type = block.type;

  return (
    <article className={'lesson-block-card' + (dirty ? ' is-dirty' : '')}>
      <header className="lesson-block-card-header">
        {dragHandle}
        <button
          type="button"
          className="lesson-block-collapse"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
        >
          <span className={'lesson-block-type-icon is-' + type}>{index + 1}</span>
          <span>
            <strong>{blockTypeLabels[type]}</strong>
            <small>{blockTypeDescriptions[type]}</small>
          </span>
          {dirty && <em>Unsaved</em>}
          <span className="lesson-block-chevron" aria-hidden="true">{open ? '⌃' : '⌄'}</span>
        </button>

        <div className="lesson-block-actions">
          <button type="button" className="lesson-block-save" disabled={!dirty || saving || reorderBusy} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save block'}
          </button>
          <button type="button" disabled={index === 0 || reorderBusy} onClick={() => onMove(block.id, -1)} aria-label="Move block up">↑</button>
          <button type="button" disabled={index === total - 1 || reorderBusy} onClick={() => onMove(block.id, 1)} aria-label="Move block down">↓</button>
          <button type="button" className="is-danger" disabled={reorderBusy} onClick={() => onDelete(block.id)} aria-label="Delete block">×</button>
        </div>
      </header>

      {open && (
        <div className="lesson-block-card-body">
          <div className="lesson-block-editor-content">
            {type === 'reading' && (
              <ReadingEditor
                content={content}
                settings={settings}
                onContent={changeContent}
                onSettings={changeSettings}
              />
            )}

            {type === 'multiple_choice' && (
              <MultipleChoiceEditor
                content={content}
                settings={settings}
                onContent={changeContent}
                onSettings={changeSettings}
              />
            )}

            {(type === 'image' || type === 'audio' || type === 'video') && (
              <MediaBlockEditor
                type={type}
                content={content}
                settings={settings}
                onContent={changeContent}
                onSettings={changeSettings}
              />
            )}

            {type === 'conversation' && (
              <ConversationEditor
                content={content}
                settings={settings}
                onContent={changeContent}
                onSettings={changeSettings}
              />
            )}
          </div>

          <details className="lesson-block-behavior">
            <summary>Behavior & completion</summary>
            <div className="lesson-builder-contract-row">
              <label className="lesson-builder-field">
                <span>Interaction mode <small>fixed by block type in MVP</small></span>
                <input value={interaction.mode} readOnly />
              </label>
            </div>
            <CompletionEditor
              type={type}
              completion={completion}
              onChange={(next) => {
                setCompletion(next);
                setDirty(true);
              }}
            />
          </details>

          {error && <div className="lesson-builder-inline-error">{error}</div>}

          <footer className="lesson-block-card-footer">
            <span>Changes stay local until you save this block.</span>
            <button type="button" disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save block'}
            </button>
          </footer>
        </div>
      )}
    </article>
  );
}

export function LessonBuilder() {
  const [lessons, setLessons] = useState<LessonBuilderSummary[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [detail, setDetail] = useState<LessonBuilderDetail | null>(null);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [creatingType, setCreatingType] = useState<LessonBlockType | null>(null);
  const [reordering, setReordering] = useState(false);
  const reorderPending = useRef(false);
  const blockDrag = useDragReorder((from, to) => void reorderBlocks(from, to), reordering || loadingDetail || creatingType !== null);
  const [error, setError] = useState('');

  const [lessonQuery, setLessonQuery] = useState('');
  const [showLessons, setShowLessons] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(emptyLessonFilters);
  const [countryLanguages, setCountryLanguages] = useState<LessonBuilderCountryLanguage[]>([]);
  const { options: filterOptions, rows: filteredLessons } = useMemo(
    () => buildLessonFilters(lessons, countryLanguages, filters),
    [lessons, countryLanguages, filters],
  );
  const visibleLessons = filteredLessons.filter(lesson =>
    `${lesson.title} ${lesson.courseTitle} ${lesson.moduleTitle}`.toLowerCase().includes(lessonQuery.toLowerCase()));
  const visibleLessonIds = JSON.stringify(visibleLessons.map(lesson => lesson.id));
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  useEffect(() => {
    const ids: string[] = JSON.parse(visibleLessonIds);
    setSelectedLessonId(ids[0] ?? '');
  }, [visibleLessonIds]);

  function changeFilter(key: FilterKey, value: string) {
    setFilters(current => {
      const next = { ...current, [key]: value };
      const index = filterFields.findIndex(field => field.key === key);
      for (const field of filterFields.slice(index + 1)) next[field.key] = '';
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    setLoadingLessons(true);
    setError('');

    void Promise.all([lessonBuilderApi.listLessons(), lessonBuilderApi.filterOptions()])
      .then(([rows, links]) => {
        if (cancelled) return;
        setLessons(rows);
        setCountryLanguages(links);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoadingLessons(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedLessonId) {
      setDetail(null);
      setLoadingDetail(false);
      return;
    }

    let cancelled = false;
    setLoadingDetail(true);
    setError('');

    void lessonBuilderApi.getLesson(selectedLessonId)
      .then((next) => {
        if (!cancelled) setDetail(next);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedLessonId]);

  const selectedSummary = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) ?? null,
    [lessons, selectedLessonId],
  );

  async function createBlock(type: LessonBlockType) {
    if (!selectedLessonId || reorderPending.current) return;
    setCreatingType(type);
    setError('');
    try {
      const { block } = await lessonBuilderApi.createBlock(selectedLessonId, { type });
      setDetail((current) => current ? { ...current, blocks: [...current.blocks, block] } : current);
      setLessons((rows) => rows.map((lesson) => lesson.id === selectedLessonId
        ? { ...lesson, blockCount: lesson.blockCount + 1 }
        : lesson));
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setCreatingType(null);
    }
  }

  function applySavedBlock(saved: LessonBlock) {
    setDetail((current) => current
      ? {
          ...current,
          blocks: current.blocks.map((block) => block.id === saved.id ? saved : block),
        }
      : current);
  }

  async function moveBlock(blockId: string, direction: -1 | 1) {
    if (!detail) return;
    const index = detail.blocks.findIndex((block) => block.id === blockId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= detail.blocks.length) return;

    await reorderBlocks(blockId, detail.blocks[targetIndex].id);
  }

  async function reorderBlocks(sourceId: string, targetId: string) {
    if (!detail || reorderPending.current || creatingType !== null) return;
    const previous = detail.blocks;
    const next = moveItem(previous, sourceId, targetId);
    if (next === previous) return;
    const lessonId = detail.lesson.id;
    reorderPending.current = true;
    setReordering(true);
    setError('');
    setDetail(current => current?.lesson.id === lessonId ? { ...current, blocks: next } : current);
    try {
      await lessonBuilderApi.reorderBlocks(lessonId, next.map((block) => block.id));
    } catch (reorderError) {
      setDetail(current => {
        if (current?.lesson.id !== lessonId) return current;
        const latest = new Map(current.blocks.map(block => [block.id, block]));
        return { ...current, blocks: previous.map(block => latest.get(block.id) ?? block) };
      });
      setError(reorderError instanceof Error ? reorderError.message : String(reorderError));
    } finally {
      reorderPending.current = false;
      setReordering(false);
    }
  }

  async function deleteBlock(blockId: string) {
    if (!detail || reorderPending.current || !window.confirm('Delete this block from the lesson?')) return;
    setError('');
    try {
      await lessonBuilderApi.deleteBlock(detail.lesson.id, blockId);
      const nextBlocks = detail.blocks.filter((block) => block.id !== blockId);
      setDetail({ ...detail, blocks: nextBlocks });
      setLessons((rows) => rows.map((lesson) => lesson.id === detail.lesson.id
        ? { ...lesson, blockCount: Math.max(0, lesson.blockCount - 1) }
        : lesson));
      if (nextBlocks.length > 0) {
        await lessonBuilderApi.reorderBlocks(detail.lesson.id, nextBlocks.map((block) => block.id));
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    }
  }

  return (
    <section className={'lesson-builder' + (showLessons ? '' : ' is-list-hidden')}>
      <div className="lesson-builder-heading">
        <div>
          <p>Choose a lesson, add blocks, and preview your reading content.</p>
        </div>
        <button type="button" className="lesson-builder-list-toggle" aria-expanded={showLessons} aria-controls="builder-lesson-list" onClick={() => setShowLessons(value => !value)}>{showLessons ? 'Hide lesson list' : 'Show lesson list'}</button>
      </div>

      {error && <div className="settings-error" role="alert">{error}</div>}

      <div className="lesson-builder-filters">
        <button type="button" className="lesson-builder-list-toggle" aria-expanded={showFilters}
          aria-controls="builder-filter-criteria" onClick={() => setShowFilters(value => !value)}>
          {showFilters ? '▾' : '▸'} Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
        <div id="builder-filter-criteria" hidden={!showFilters}>
          <div className="lesson-builder-filter-grid">
            {filterFields.map(({ key, label }) => (
              <label className="lesson-builder-field" key={key}>
                <span>{label}</span>
                <select value={filters[key]} disabled={loadingLessons} onChange={event => changeFilter(key, event.target.value)}>
                  <option value="">All</option>
                  {filterOptions[key].map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            ))}
            <label className="lesson-builder-field">
              <span>Date from (updated)</span>
              <input type="date" value={filters.dateFrom} max={filters.dateTo || undefined}
                onChange={event => setFilters(current => ({ ...current, dateFrom: event.target.value }))} />
            </label>
            <label className="lesson-builder-field">
              <span>Date to (updated)</span>
              <input type="date" value={filters.dateTo} min={filters.dateFrom || undefined}
                onChange={event => setFilters(current => ({ ...current, dateTo: event.target.value }))} />
            </label>
          </div>
          {filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo && (
            <p className="lesson-builder-inline-error" role="alert">Date from must be on or before date to.</p>
          )}
          <div className="lesson-builder-filter-footer">
            <span>{visibleLessons.length} of {lessons.length} lessons · Updated date in your local time</span>
            <button type="button" className="lesson-builder-list-toggle" onClick={() => { setFilters(emptyLessonFilters); setLessonQuery(''); }}>Clear filters</button>
          </div>
        </div>
      </div>

      <div className="lesson-builder-layout">
        <aside className="lesson-builder-lessons" id="builder-lesson-list" hidden={!showLessons}>
          <div className="lesson-builder-panel-title">
            <strong>Lessons</strong>
            <span>{visibleLessons.length}</span>
          </div>
          <input className="lesson-builder-search" aria-label="Search lessons" placeholder="Search lessons or modules…" value={lessonQuery} onChange={event => setLessonQuery(event.target.value)} />
          {loadingLessons ? (
            <div className="lesson-builder-soft-empty">Loading lessons…</div>
          ) : lessons.length === 0 ? (
            <div className="lesson-builder-soft-empty">Create a lesson first.</div>
          ) : (
            <div className="lesson-builder-lesson-list">
              {visibleLessons.map((lesson) => (
                <button
                  type="button"
                  key={lesson.id}
                  className={selectedLessonId === lesson.id ? 'is-active' : ''}
                  aria-pressed={selectedLessonId === lesson.id}
                  onClick={() => setSelectedLessonId(lesson.id)}
                >
                  <span>
                    <strong>{lesson.title}</strong>
                    <small>{lesson.courseTitle} · {lesson.moduleTitle}</small>
                  </span>
                  <em>{lesson.blockCount}</em>
                </button>
              ))}
              {visibleLessons.length === 0 && <p className="lesson-builder-soft-empty">No matching lessons.</p>}
            </div>
          )}
        </aside>

        <div className="lesson-builder-workspace" data-speech-lang={selectedSummary?.languageCode}>
          {!selectedLessonId ? (
            <div className="lesson-builder-empty-state">
              <strong>Select a lesson</strong>
              <p>Choose a lesson on the left to start adding blocks.</p>
            </div>
          ) : loadingDetail || !detail || detail.lesson.id !== selectedLessonId ? (
            <div className="lesson-builder-empty-state">
              <strong>Loading lesson…</strong>
            </div>
          ) : (
            <>
              <div className="lesson-builder-lesson-header">
                <div>
                  <span>{selectedSummary?.courseTitle} / {selectedSummary?.moduleTitle}</span>
                  <h3>{detail.lesson.title}</h3>
                  <p>{detail.lesson.description || 'No lesson description yet.'}</p>
                </div>
                <div className={'lesson-builder-publish-chip' + (detail.lesson.isPublished ? ' is-published' : '')}>
                  {detail.lesson.isPublished ? 'Published' : 'Draft'}
                </div>
              </div>

              <details className="lesson-block-palette" key={detail.lesson.id} open={detail.blocks.length === 0 || undefined}>
                <summary className="lesson-builder-subheading">
                  <span>Add a block</span>
                  <small>Reading, questions, media, or conversation</small>
                </summary>
                <div className="lesson-block-palette-grid">
                  {LESSON_BLOCK_TYPES.map((type) => (
                    <button
                      type="button"
                      key={type}
                      disabled={creatingType !== null || reordering}
                      onClick={() => void createBlock(type)}
                    >
                      <span className={'lesson-block-palette-icon is-' + type}>+</span>
                      <span>
                        <strong>{blockTypeLabels[type]}</strong>
                        <small>{blockTypeDescriptions[type]}</small>
                      </span>
                      {creatingType === type && <em>Adding…</em>}
                    </button>
                  ))}
                </div>
              </details>

              {detail.blocks.length > 1 && <p className="master-reorder-hint">Drag the ⋮⋮ handle to reorder blocks. <span role="status">{reordering ? 'Saving order…' : 'Order saves automatically.'}</span></p>}
              <div className="lesson-block-list">
                {detail.blocks.length === 0 ? (
                  <div className="lesson-builder-empty-state is-compact">
                    <strong>This lesson has no blocks yet.</strong>
                    <p>Choose a block type above to create the first one.</p>
                  </div>
                ) : detail.blocks.map((block, index) => (
                  <div key={block.id} {...blockDrag.rowProps(block.id, detail.lesson.id)}
                    className={(blockDrag.draggingId === block.id ? 'is-dragging ' : '') + (blockDrag.targetId === block.id ? 'is-drop-target' : '')}>
                  <BlockCard
                    block={block}
                    index={index}
                    total={detail.blocks.length}
                    onSaved={applySavedBlock}
                    onMove={moveBlock}
                    onDelete={deleteBlock}
                    reorderBusy={reordering}
                    dragHandle={blockDrag.handle(block.id, detail.lesson.id, `${blockTypeLabels[block.type]} block ${index + 1}`, detail.blocks.map(item => item.id))}
                  />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
