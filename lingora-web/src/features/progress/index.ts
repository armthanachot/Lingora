import { apiRequest } from '../../api/client';

export type LessonProgress = {
  id: string;
  enrollmentId: string;
  lessonId: string;
  status: string;
  percent: number;
  currentBlockId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LearnerBlockState = {
  id: string;
  enrollmentId: string;
  lessonId: string;
  blockId: string;
  response: unknown;
  attempts: number;
  score: number | null;
  completed: boolean;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BlockFeedback = {
  explanation?: string;
};

export type LessonProgressDetail = {
  progress: LessonProgress | null;
  blockStates: LearnerBlockState[];
  feedbackByBlock: Record<string, BlockFeedback>;
};

export const progressApi = {
  list: () => apiRequest<LessonProgress[]>('/progress/'),
  get: (id: string) => apiRequest<LessonProgress>(`/progress/${encodeURIComponent(id)}`),
  getLesson: (lessonId: string) =>
    apiRequest<LessonProgressDetail>(
      `/progress/lesson/${encodeURIComponent(lessonId)}`,
    ),
  submitBlock: (
    lessonId: string,
    blockId: string,
    input: { response: unknown; score?: number; completed?: boolean },
  ) =>
    apiRequest<{
      state: LearnerBlockState;
      progress: LessonProgress;
      feedback: BlockFeedback | null;
    }>(
      `/progress/lesson/${encodeURIComponent(lessonId)}/blocks/${encodeURIComponent(blockId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
    ),
};
