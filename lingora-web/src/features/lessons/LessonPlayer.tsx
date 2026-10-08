import { useEffect, useState } from 'react';
import { lessonApi, type LessonDetail } from '.';
import {
  progressApi,
  type BlockFeedback,
  type LearnerBlockState,
  type LessonProgress,
} from '../progress';
import type { LessonBlock, MediaAsset } from './blocks';
import { ReadingContent } from './ReadingContent';

type PlayerState = {
  progress: LessonProgress | null;
  blockStates: LearnerBlockState[];
  feedbackByBlock: Record<string, BlockFeedback>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function mediaAsset(value: unknown): MediaAsset | null {
  const data = asRecord(value);
  return (data.source === 'upload' || data.source === 'url') && typeof data.url === 'string'
    ? data as unknown as MediaAsset
    : null;
}

function stateResponseChoice(state?: LearnerBlockState) {
  const response = asRecord(state?.response);
  return typeof response.choiceId === 'string' ? response.choiceId : '';
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function ReadingBlockView({ block }: { block: LessonBlock }) {
  const content = asRecord(block.content);
  const settings = asRecord(block.settings);
  const alignment = settings.alignment === 'center' ? 'center' : 'left';
  const textSize = settings.textSize === 'small' || settings.textSize === 'large'
    ? settings.textSize
    : 'medium';

  return (
    <article className={'lesson-player-reading is-' + textSize} style={{ textAlign: alignment }}>
      {asString(content.title) && <h2>{asString(content.title)}</h2>}
      <div className="lesson-player-reading-body"><ReadingContent body={asString(content.body)} format={content.format} /></div>
    </article>
  );
}

function ImageBlockView({ block }: { block: LessonBlock }) {
  const content = asRecord(block.content);
  const settings = asRecord(block.settings);
  const media = mediaAsset(content.media);
  if (!media) return <div className="lesson-player-placeholder">Image not configured.</div>;

  return (
    <figure className="lesson-player-image">
      <img
        src={media.url}
        alt={asString(content.alt)}
        style={{ objectFit: settings.fit === 'cover' ? 'cover' : 'contain' }}
      />
      {asString(content.caption) && <figcaption>{asString(content.caption)}</figcaption>}
    </figure>
  );
}

function AudioBlockView({ block }: { block: LessonBlock }) {
  const content = asRecord(block.content);
  const settings = asRecord(block.settings);
  const media = mediaAsset(content.media);
  if (!media) return <div className="lesson-player-placeholder">Audio not configured.</div>;

  return (
    <section className="lesson-player-media">
      {asString(content.title) && <h2>{asString(content.title)}</h2>}
      <audio
        src={media.url}
        controls={settings.controls !== false}
        autoPlay={settings.autoplay === true}
        preload="metadata"
      />
      {asString(content.transcript) && (
        <div className="lesson-player-transcript">{asString(content.transcript)}</div>
      )}
    </section>
  );
}

function VideoBlockView({ block }: { block: LessonBlock }) {
  const content = asRecord(block.content);
  const settings = asRecord(block.settings);
  const media = mediaAsset(content.media);
  if (!media) return <div className="lesson-player-placeholder">Video not configured.</div>;

  return (
    <section className="lesson-player-media">
      {asString(content.title) && <h2>{asString(content.title)}</h2>}
      <video
        src={media.url}
        controls={settings.controls !== false}
        autoPlay={settings.autoplay === true}
        preload="metadata"
      />
      {asString(content.caption) && <p>{asString(content.caption)}</p>}
    </section>
  );
}

function ConversationBlockView({ block }: { block: LessonBlock }) {
  const content = asRecord(block.content);
  const settings = asRecord(block.settings);
  const participants = Array.isArray(content.participants)
    ? content.participants.map(asRecord)
    : [];
  const turns = Array.isArray(content.turns) ? content.turns.map(asRecord) : [];
  const participantsById = new Map(
    participants.flatMap((participant) =>
      typeof participant.id === 'string' ? [[participant.id, participant] as const] : []),
  );
  const scriptLayout = settings.layout === 'script';

  return (
    <section className={'lesson-player-conversation' + (scriptLayout ? ' is-script' : '')}>
      {asString(content.title) && <h2>{asString(content.title)}</h2>}
      <div className="lesson-player-conversation-list">
        {turns.map((turn, index) => {
          const speakerId = asString(turn.speakerId);
          const participant = participantsById.get(speakerId);
          const speakerName = asString(participant?.name) || 'Speaker';
          const avatarUrl = asString(participant?.avatarUrl);

          return (
            <div className="lesson-player-conversation-turn" key={asString(turn.id) || String(index)}>
              <div className="lesson-player-conversation-avatar">
                {avatarUrl
                  ? <img src={avatarUrl} alt="" />
                  : <span>{speakerName.slice(0, 1).toUpperCase()}</span>}
              </div>
              <div>
                {settings.showSpeakerNames !== false && <strong>{speakerName}</strong>}
                <p>{asString(turn.text)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MultipleChoiceBlockView({
  block,
  state,
  busy,
  feedback,
  onSubmit,
}: {
  block: LessonBlock;
  state?: LearnerBlockState;
  busy?: boolean;
  feedback?: BlockFeedback;
  onSubmit: (response: unknown) => void;
}) {
  const content = asRecord(block.content);
  const settings = asRecord(block.settings);
  const rawChoices = Array.isArray(content.choices) ? content.choices.map(asRecord) : [];
  const choices = settings.shuffleChoices === true
    ? [...rawChoices].sort(
        (left, right) =>
          stableHash(block.id + asString(left.id)) - stableHash(block.id + asString(right.id)),
      )
    : rawChoices;
  const [selectedChoiceId, setSelectedChoiceId] = useState(() => stateResponseChoice(state));

  useEffect(() => {
    setSelectedChoiceId(stateResponseChoice(state));
  }, [state]);

  return (
    <section className="lesson-player-question">
      <span className="lesson-player-kicker">Choose one answer</span>
      <h2>{asString(content.question)}</h2>

      <div className="lesson-player-choice-list">
        {choices.map((choice, index) => {
          const id = asString(choice.id);
          const selected = selectedChoiceId === id;
          return (
            <button
              type="button"
              className={selected ? 'is-selected' : ''}
              key={id || String(index)}
              onClick={() => setSelectedChoiceId(id)}
              disabled={busy}
            >
              <span>{String.fromCharCode(65 + index)}</span>
              <strong>{asString(choice.text)}</strong>
            </button>
          );
        })}
      </div>

      {state && (
        <div className={'lesson-player-answer-status' + (state.completed ? ' is-complete' : '')}>
          {state.completed
            ? 'Completed'
            : state.attempts > 0
              ? 'Not completed yet — try again.'
              : ''}
          {state.score !== null && <span>{Math.round(state.score)}%</span>}
        </div>
      )}

      {state?.completed && feedback?.explanation && (
        <div className="lesson-player-explanation">{feedback.explanation}</div>
      )}

      <button
        type="button"
        className="lesson-player-primary"
        disabled={!selectedChoiceId || busy}
        onClick={() => onSubmit({ choiceId: selectedChoiceId })}
      >
        {busy ? 'Checking…' : state?.completed ? 'Submit again' : 'Check answer'}
      </button>
    </section>
  );
}

export function LessonBlockRenderer({
  block,
  state,
  busy,
  feedback,
  onSubmit,
}: {
  block: LessonBlock;
  state?: LearnerBlockState;
  busy?: boolean;
  feedback?: BlockFeedback;
  onSubmit: (response: unknown) => void;
}) {
  switch (block.type) {
    case 'reading':
      return <ReadingBlockView block={block} />;
    case 'multiple_choice':
      return (
        <MultipleChoiceBlockView
          block={block}
          state={state}
          busy={busy}
          feedback={feedback}
          onSubmit={onSubmit}
        />
      );
    case 'image':
      return <ImageBlockView block={block} />;
    case 'audio':
      return <AudioBlockView block={block} />;
    case 'video':
      return <VideoBlockView block={block} />;
    case 'conversation':
      return <ConversationBlockView block={block} />;
  }
}

export function LessonPlayer({
  lessonId,
  onExit,
  onNext,
  nextLessonTitle,
}: {
  lessonId: string;
  onExit?: () => void;
  onNext?: () => void;
  nextLessonTitle?: string;
}) {
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>({
    progress: null,
    blockStates: [],
    feedbackByBlock: {},
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewFinished, setReviewFinished] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFinished(false);
    setReviewFinished(false);
    setLesson(null);
    setLoading(true);
    setError('');

    void Promise.all([
      lessonApi.get(lessonId),
      progressApi.getLesson(lessonId),
    ])
      .then(([lessonDetail, progressDetail]) => {
        if (cancelled) return;
        setLesson(lessonDetail);
        setPlayerState(progressDetail);
        setReviewing(progressDetail.progress?.status === 'completed');

        const completedIds = new Set(
          progressDetail.blockStates
            .filter((state) => state.completed)
            .map((state) => state.blockId),
        );
        const preferredId = progressDetail.progress?.currentBlockId;
        const preferredIndex = preferredId
          ? lessonDetail.blocks.findIndex((block) => block.id === preferredId)
          : -1;
        const firstIncomplete = lessonDetail.blocks.findIndex((block) => !completedIds.has(block.id));

        setActiveIndex(preferredIndex >= 0 ? preferredIndex : Math.max(0, firstIncomplete));
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lessonId, retry]);

  const activeBlock = lesson?.blocks[activeIndex] ?? null;
  const activeState = activeBlock
    ? playerState.blockStates.find((state) => state.blockId === activeBlock.id)
    : undefined;
  const activeFeedback = activeBlock ? playerState.feedbackByBlock[activeBlock.id] : undefined;
  const isInteractiveAnswer = activeBlock?.interaction.mode === 'answer';

  const percent = playerState.progress?.percent
    ?? (lesson && lesson.blocks.length > 0
      ? Math.round(
          (playerState.blockStates.filter((state) => state.completed).length / lesson.blocks.length) * 100,
        )
      : 0);

  const completed = playerState.progress?.status === 'completed';

  async function submit(response: unknown, customCompleted?: boolean) {
    if (!activeBlock || busy) return null;
    setBusy(true);
    setError('');
    try {
      const result = await progressApi.submitBlock(lessonId, activeBlock.id, {
        response,
        completed: customCompleted,
      });
      setPlayerState((current) => ({
        progress: result.progress,
        blockStates: [
          ...current.blockStates.filter((state) => state.blockId !== result.state.blockId),
          result.state,
        ],
        feedbackByBlock: {
          ...current.feedbackByBlock,
          ...(result.feedback ? { [result.state.blockId]: result.feedback } : {}),
        },
      }));
      return result;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function continueFromPassiveBlock() {
    if (!activeBlock) return;
    if (reviewing && activeState?.completed) {
      if (lesson && activeIndex + 1 < lesson.blocks.length) setActiveIndex(activeIndex + 1);
      else { setReviewFinished(true); setReviewing(false); setFinished(true); }
      return;
    }
    const result = await submit(
      { viewed: true },
      activeBlock.completion.rule === 'custom' ? true : undefined,
    );
    if (!result?.state.completed) return;

    const nextIndex = activeIndex + 1;
    if (lesson && nextIndex < lesson.blocks.length) setActiveIndex(nextIndex);
    else setFinished(true);
  }

  function nextAfterCompletedAnswer() {
    if (!lesson || !activeState?.completed) return;
    if (activeIndex === lesson.blocks.length - 1) { setReviewFinished(reviewing); setReviewing(false); setFinished(true); }
    else setActiveIndex(current => current + 1);
  }

  if (loading) return <div className="lesson-player-shell"><div className="lesson-player-loading">Loading lesson…</div></div>;
  if (error && !lesson) return <div className="lesson-player-shell"><div className="lesson-player-error" role="alert">{error}</div><button onClick={() => setRetry(value => value + 1)}>Try again</button><button onClick={onExit}>Back to course</button></div>;
  if (!lesson) return null;

  return (
    <main className="lesson-player-shell">
      <header className="lesson-player-header">
        <button type="button" onClick={onExit} disabled={!onExit || busy} aria-label="Back to course">←</button>
        <div>
          <span>{reviewing ? 'Review · Completed lesson' : 'Lesson'}</span>
          <strong>{lesson.title}</strong>
        </div>
        <div className="lesson-player-progress">
          <span>{percent}%</span>
          <div><i style={{ width: percent + '%' }} /></div>
        </div>
      </header>

      {lesson.blocks.length === 0 ? (
        <section className="lesson-player-empty">
          <strong>This lesson has no blocks yet.</strong>
        </section>
      ) : !reviewing && finished && completed && activeIndex >= lesson.blocks.length - 1 && activeState?.completed ? (
        <section className="lesson-player-complete">
          <span>✓</span>
          <h1>{reviewFinished ? 'Review complete' : 'Lesson complete'}</h1>
          <p>{reviewFinished ? 'You reviewed every block. Your lesson remains complete.' : 'You finished every block in this lesson.'}</p>
          {onNext && <button type="button" className="lesson-player-primary" onClick={onNext}>Next lesson: {nextLessonTitle} →</button>}
          <button type="button" className="lesson-player-next" onClick={() => { setActiveIndex(0); setReviewFinished(false); setReviewing(true); }}>Review lesson</button>
          {onExit && <button type="button" className="lesson-player-primary" onClick={onExit}>Back to course</button>}
        </section>
      ) : activeBlock ? (
        <section className="lesson-player-stage">
          <div className="lesson-player-step">
            Block {activeIndex + 1} of {lesson.blocks.length}
          </div>

          {activeIndex > 0 && <button className="lesson-player-next" disabled={busy} onClick={() => setActiveIndex(index => index - 1)}>← Previous block</button>}
          <LessonBlockRenderer
            key={activeBlock.id}
            block={activeBlock}
            state={activeState}
            busy={busy}
            feedback={activeFeedback}
            onSubmit={(response) => void submit(response)}
          />

          {error && <div className="lesson-player-error">{error}</div>}

          {isInteractiveAnswer ? (
            activeState?.completed && (
              <button
                type="button"
                className="lesson-player-next"
                onClick={nextAfterCompletedAnswer}
                disabled={busy}
              >
                {activeIndex === lesson.blocks.length - 1 ? reviewing ? 'Finish review' : 'Finish lesson' : 'Continue →'}
              </button>
            )
          ) : (
            <button
              type="button"
              className="lesson-player-primary"
              disabled={busy}
              onClick={() => void continueFromPassiveBlock()}
            >
              {busy
                ? 'Saving…'
                : activeIndex === lesson.blocks.length - 1
                  ? reviewing ? 'Finish review' : 'Finish lesson'
                  : 'Continue →'}
            </button>
          )}
        </section>
      ) : null}
    </main>
  );
}
