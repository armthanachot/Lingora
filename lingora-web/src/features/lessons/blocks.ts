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

export type MediaAsset = {
  source: 'upload' | 'url';
  url: string;
  storagePath?: string;
  mimeType?: string;
  originalName?: string;
};

export type LessonBlock = {
  id: string;
  lessonId: string;
  type: LessonBlockType;
  version: number;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  interaction: { mode: BlockInteractionMode; [key: string]: unknown };
  completion: { rule: BlockCompletionRule; minimumScore?: number; [key: string]: unknown };
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type LessonWithBlocks = {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  content: unknown;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  blocks: LessonBlock[];
};

export const blockTypeLabels: Record<LessonBlockType, string> = {
  reading: 'Reading',
  multiple_choice: 'Multiple Choice',
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
  conversation: 'Conversation',
};

export const blockTypeDescriptions: Record<LessonBlockType, string> = {
  reading: 'Long-form text, explanation, or reading passage.',
  multiple_choice: 'Question with selectable answers and optional explanation.',
  image: 'Image with alt text and optional caption.',
  audio: 'Audio lesson, pronunciation clip, or listening material.',
  video: 'Video lesson or example with optional caption.',
  conversation: 'Structured multi-speaker dialogue with reusable participants.',
};
