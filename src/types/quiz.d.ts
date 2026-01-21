/**
 * Global Quiz Type Definitions
 * Centralized type system for all quiz-related components
 */

// ============================================================================
// QUESTION TYPES
// ============================================================================

export type QuestionType =
  | "multiple_choice"
  | "checkboxes"
  | "short_answer"
  | "paragraph";

export interface BaseQuestion {
  id: string | number;
  type: QuestionType | string;
  text?: string;
  requiresManualGrading?: boolean;
  [key: string]: any;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: "multiple_choice";
  options?: string[];
  correctAnswer?: string | number | null;
}

export interface CheckboxQuestion extends BaseQuestion {
  type: "checkboxes";
  options?: string[];
  correctAnswer?: number[];
}

export interface ShortAnswerQuestion extends BaseQuestion {
  type: "short_answer";
  sentenceLimit?: number | string | null;
  correctAnswer?: string;
}

export interface ParagraphQuestion extends BaseQuestion {
  type: "paragraph";
  sentenceLimit?: number | string | null;
  correctAnswer?: string;
}

export type Question =
  | MultipleChoiceQuestion
  | CheckboxQuestion
  | ShortAnswerQuestion
  | ParagraphQuestion
  | BaseQuestion;

// ============================================================================
// PAGE TYPES
// ============================================================================

export interface Page {
  id: string;
  title: string;
  questions: Question[];
  [key: string]: any;
}

export interface PageData {
  id: string;
  title: string;
  questions: Question[];
}

// ============================================================================
// QUIZ TYPES
// ============================================================================

export interface Quiz {
  id: string | number;
  title?: string;
  description?: string;
  start_time?: string | null;
  end_time?: string | null;
  questions_count?: number;
  question_count?: number;
  pages_count?: number;
  attempts_allowed?: number;
  attemptsAllowed?: number;
  attempts_remaining?: number | null;
  time_limit_seconds?: number | null;
  timeLimitSeconds?: number | null;
  questions?: any;
  classroom_code?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface ServerQuiz {
  id?: string | number;
  title?: string | null;
  description?: string | null;
  attempts_allowed?: number | null;
  time_limit_seconds?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  questions?: any;
  [key: string]: any;
}

export interface QuizInitialData {
  quizId?: string | null;
  title?: string;
  attemptsAllowed?: number | string | null;
  timeLimitSeconds?: number | null;
  pages?: Page[];
  mode?: "edit" | "create";
  [key: string]: any;
}

// ============================================================================
// ATTEMPT TYPES
// ============================================================================

export interface QuizAttempt {
  id: number | string;
  quiz_id?: number | string;
  student_id?: number | string;
  student_name?: string | null;
  student_username?: string | null;
  attempt_no?: number;
  status?: "in_progress" | "completed" | "needs_grading" | "abandoned" | string;
  score?: number | null;
  answers?: Record<string, any>;
  grading?: Record<string, any>;
  started_at?: string;
  submitted_at?: string | null;
  expires_at?: string | null;
  comment?: string | null;
  [key: string]: any;
}

export interface QuizAttemptResponse {
  id: number | string;
  quiz_id: number | string;
  student_id: number | string;
  attempt_no: number;
  status: string;
  score: number | null;
  answers: Record<string, any>;
  grading: Record<string, any>;
  started_at: string;
  submitted_at: string | null;
  expires_at: string | null;
  comment?: string | null;
}

// ============================================================================
// GRADING TYPES
// ============================================================================

export interface QuestionGrading {
  correct?: boolean;
  questionScore?: number;
  feedback?: string;
  manualScore?: number;
  [key: string]: any;
}

export interface GradingPayload {
  [questionId: string]: QuestionGrading;
}

export interface GradingState {
  questionScores: Record<string, number>;
  gradingScore: string;
  gradingComment: string;
  gradingPayload: GradingPayload;
  timestamp?: number;
}

// ============================================================================
// COMPONENT PROPS TYPES
// ============================================================================

export interface QuizEditorProps {
  classroomCode?: string;
  initialData?: QuizInitialData | null;
}

export interface QuizTimerProps {
  expiresAt?: Date | string | null;
  onExpire?: () => void;
  className?: string;
  size?: "small" | "medium" | "large";
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface QuizApiResponse {
  success?: boolean;
  quiz?: Quiz | ServerQuiz | null;
  quizzes?: Quiz[];
  message?: string;
  error?: string;
}

export interface AttemptApiResponse {
  success?: boolean;
  attempt?: QuizAttempt | null;
  attempts?: QuizAttempt[];
  message?: string;
  error?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type QuizStatus = "draft" | "published" | "archived";
export type AttemptStatus =
  | "in_progress"
  | "completed"
  | "needs_grading"
  | "abandoned";

export interface QuizMetadata {
  totalQuestions: number;
  totalPages: number;
  estimatedTime: number; // in minutes
  hasManualGrading: boolean;
}
