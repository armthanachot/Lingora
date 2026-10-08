export const LESSON_BLOCK_TYPES = [
  'reading',
  'multiple_choice',
  'image',
  'audio',
  'video',
  'conversation',
] as const;

export type LessonBlockType = (typeof LESSON_BLOCK_TYPES)[number];

export type BlockInteractionMode = 'none' | 'answer' | 'activity';
export type BlockCompletionRule = 'viewed' | 'answered' | 'correct' | 'score' | 'custom';

export type BlockInteraction = {
  mode: BlockInteractionMode;
};

export type BlockCompletion = {
  rule: BlockCompletionRule;
  minimumScore?: number;
};

export type MediaAsset = {
  source: 'upload' | 'url';
  url: string;
  storagePath?: string;
  mimeType?: string;
  originalName?: string;
};

export type LessonBlockDefinition = {
  id: string;
  lessonId: string;
  type: LessonBlockType;
  version: number;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  interaction: BlockInteraction;
  completion: BlockCompletion;
  sortOrder: number;
};

type BlockDefaults = Omit<LessonBlockDefinition, 'id' | 'lessonId' | 'sortOrder'>;

const defaults: Record<LessonBlockType, BlockDefaults> = {
  reading: {
    type: 'reading',
    version: 1,
    content: { title: '', body: '', format: 'markdown' },
    settings: { textSize: 'medium', alignment: 'left' },
    interaction: { mode: 'none' },
    completion: { rule: 'viewed' },
  },
  multiple_choice: {
    type: 'multiple_choice',
    version: 1,
    content: {
      question: '',
      choices: [
        { id: 'choice_1', text: '' },
        { id: 'choice_2', text: '' },
      ],
      correctChoiceId: 'choice_1',
      explanation: '',
    },
    settings: { shuffleChoices: false, showExplanation: true },
    interaction: { mode: 'answer' },
    completion: { rule: 'correct' },
  },
  image: {
    type: 'image',
    version: 1,
    content: { media: null, alt: '', caption: '' },
    settings: { fit: 'contain' },
    interaction: { mode: 'none' },
    completion: { rule: 'viewed' },
  },
  audio: {
    type: 'audio',
    version: 1,
    content: { media: null, title: '', transcript: '' },
    settings: { autoplay: false, controls: true },
    interaction: { mode: 'activity' },
    completion: { rule: 'viewed' },
  },
  video: {
    type: 'video',
    version: 1,
    content: { media: null, title: '', caption: '' },
    settings: { autoplay: false, controls: true },
    interaction: { mode: 'activity' },
    completion: { rule: 'viewed' },
  },
  conversation: {
    type: 'conversation',
    version: 1,
    content: {
      title: '',
      participants: [
        { id: 'speaker_1', name: 'Speaker 1' },
        { id: 'speaker_2', name: 'Speaker 2' },
      ],
      turns: [],
    },
    settings: { layout: 'chat', showSpeakerNames: true },
    interaction: { mode: 'activity' },
    completion: { rule: 'viewed' },
  },
};

export function isLessonBlockType(value: unknown): value is LessonBlockType {
  return typeof value === 'string' && (LESSON_BLOCK_TYPES as readonly string[]).includes(value);
}

export function blockDefaults(type: LessonBlockType): BlockDefaults {
  return structuredClone(defaults[type]);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireStringField(value: Record<string, unknown>, field: string) {
  if (typeof value[field] !== 'string') throw new Error(`${field} must be a string.`);
}

function validateMedia(value: unknown) {
  if (value === null || value === undefined) return;
  if (!isRecord(value)) throw new Error('media must be an object or null.');
  if (value.source !== 'upload' && value.source !== 'url') {
    throw new Error('media.source must be upload or url.');
  }
  if (typeof value.url !== 'string' || !value.url.trim()) {
    throw new Error('media.url is required when media is configured.');
  }
}

function validateTypeContent(type: LessonBlockType, content: Record<string, unknown>) {
  switch (type) {
    case 'reading':
      requireStringField(content, 'title');
      requireStringField(content, 'body');
      if (content.format !== undefined && content.format !== 'plain' && content.format !== 'markdown') {
        throw new Error('Reading format must be plain or markdown.');
      }
      return;

    case 'multiple_choice': {
      requireStringField(content, 'question');
      requireStringField(content, 'correctChoiceId');
      if (!Array.isArray(content.choices) || content.choices.length < 2) {
        throw new Error('Multiple choice blocks require at least two choices.');
      }

      const choiceIds = new Set<string>();
      for (const choice of content.choices) {
        if (!isRecord(choice) || typeof choice.id !== 'string' || typeof choice.text !== 'string') {
          throw new Error('Each choice requires string id and text fields.');
        }
        if (!choice.id) throw new Error('Choice id cannot be empty.');
        if (choiceIds.has(choice.id)) throw new Error('Choice ids must be unique.');
        choiceIds.add(choice.id);
      }

      if (!choiceIds.has(content.correctChoiceId as string)) {
        throw new Error('correctChoiceId must reference one of the choices.');
      }
      if (content.explanation !== undefined && typeof content.explanation !== 'string') {
        throw new Error('explanation must be a string.');
      }
      return;
    }

    case 'image':
      validateMedia(content.media);
      requireStringField(content, 'alt');
      requireStringField(content, 'caption');
      return;

    case 'audio':
      validateMedia(content.media);
      requireStringField(content, 'title');
      requireStringField(content, 'transcript');
      return;

    case 'video':
      validateMedia(content.media);
      requireStringField(content, 'title');
      requireStringField(content, 'caption');
      return;

    case 'conversation': {
      requireStringField(content, 'title');
      if (!Array.isArray(content.participants) || content.participants.length < 1) {
        throw new Error('Conversation blocks require at least one participant.');
      }
      if (!Array.isArray(content.turns)) throw new Error('Conversation turns must be an array.');

      const participantIds = new Set<string>();
      for (const participant of content.participants) {
        if (!isRecord(participant) || typeof participant.id !== 'string' || typeof participant.name !== 'string') {
          throw new Error('Each participant requires string id and name fields.');
        }
        if (!participant.id) throw new Error('Participant id cannot be empty.');
        if (participantIds.has(participant.id)) throw new Error('Participant ids must be unique.');
        participantIds.add(participant.id);
      }

      for (const turn of content.turns) {
        if (
          !isRecord(turn)
          || typeof turn.id !== 'string'
          || typeof turn.speakerId !== 'string'
          || typeof turn.text !== 'string'
        ) {
          throw new Error('Each conversation turn requires id, speakerId, and text strings.');
        }
        if (!participantIds.has(turn.speakerId)) {
          throw new Error('Each conversation turn must reference an existing participant.');
        }
      }
      return;
    }
  }
}

export function normalizeBlockDefinition(input: {
  type: unknown;
  version?: unknown;
  content?: unknown;
  settings?: unknown;
  interaction?: unknown;
  completion?: unknown;
}) {
  if (!isLessonBlockType(input.type)) {
    throw new Error(`Unsupported block type: ${String(input.type)}`);
  }

  const base = blockDefaults(input.type);
  const version = input.version === undefined ? base.version : Number(input.version);
  if (!Number.isInteger(version) || version < 1) throw new Error('Block version must be a positive integer.');

  const content = input.content === undefined ? base.content : input.content;
  const settings = input.settings === undefined ? base.settings : input.settings;
  const interaction = input.interaction === undefined ? base.interaction : input.interaction;
  const completion = input.completion === undefined ? base.completion : input.completion;

  if (!isRecord(content)) throw new Error('Block content must be an object.');
  if (!isRecord(settings)) throw new Error('Block settings must be an object.');
  if (!isRecord(interaction)) throw new Error('Block interaction must be an object.');
  if (!isRecord(completion)) throw new Error('Block completion must be an object.');

  validateTypeContent(input.type, content);

  const mode = interaction.mode;
  if (mode !== 'none' && mode !== 'answer' && mode !== 'activity') {
    throw new Error('Invalid interaction mode.');
  }
  if (mode !== base.interaction.mode) {
    throw new Error(`Interaction mode for ${input.type} blocks must be ${base.interaction.mode} in MVP.`);
  }

  const rule = completion.rule;
  if (rule !== 'viewed' && rule !== 'answered' && rule !== 'correct' && rule !== 'score' && rule !== 'custom') {
    throw new Error('Invalid completion rule.');
  }

  const allowedCompletionRules: BlockCompletionRule[] = input.type === 'multiple_choice'
    ? ['answered', 'correct', 'score']
    : ['viewed'];
  if (!allowedCompletionRules.includes(rule)) {
    throw new Error(
      `Completion rule ${rule} is not supported for ${input.type} blocks in MVP.`,
    );
  }

  const minimumScore = completion.minimumScore;
  if (rule === 'score' && (typeof minimumScore !== 'number' || minimumScore < 0 || minimumScore > 100)) {
    throw new Error('Score completion requires minimumScore between 0 and 100.');
  }

  return {
    type: input.type,
    version,
    content,
    settings,
    interaction: { ...interaction, mode },
    completion: { ...completion, rule },
  };
}

export function evaluateBlockResponse(
  block: {
    type: string;
    content: unknown;
    completion: unknown;
  },
  response: unknown,
  submittedScore?: number,
  submittedCompleted?: boolean,
) {
  const completion = isRecord(block.completion) ? block.completion : {};
  const rule = completion.rule;

  let score: number | null = typeof submittedScore === 'number' && Number.isFinite(submittedScore)
    ? submittedScore
    : null;
  let completed = false;

  if (block.type === 'multiple_choice' && isRecord(block.content) && isRecord(response)) {
    const selectedChoiceId = response.choiceId;
    const correctChoiceId = block.content.correctChoiceId;
    const isCorrect = typeof selectedChoiceId === 'string'
      && typeof correctChoiceId === 'string'
      && selectedChoiceId === correctChoiceId;
    score = isCorrect ? 100 : 0;

    if (rule === 'correct') completed = isCorrect;
  }

  if (rule === 'viewed') completed = true;
  if (rule === 'answered') completed = response !== null && response !== undefined;
  if (rule === 'score') {
    const minimumScore = typeof completion.minimumScore === 'number' ? completion.minimumScore : 100;
    completed = score !== null && score >= minimumScore;
  }
  if (rule === 'custom') completed = submittedCompleted === true;

  return { score, completed };
}
