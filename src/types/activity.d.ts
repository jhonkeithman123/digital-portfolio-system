/**
 * Global Activity Type Definitions
 * Centralized type system for all activity-related components
 */

// ============================================================================
// INSTRUCTION TYPES
// ============================================================================

export interface Instruction {
  id: number;
  activity_id: number;
  teacher_id: number;
  instruction_text: string;
  created_at: string;
  updated_at: string;
  username: string;
  teacher_role: string;
}

// ============================================================================
// SUBMISSION TYPES
// ============================================================================

export interface Submission {
  id: number | string;
  activity_id: number | string;
  student_id: number | string;
  original_name?: string | null;
  file_path?: string | null;
  mime_type?: string | null;
  score?: number | null;
  graded_at?: string | null;
  graded_by?: number | null;
  created_at?: string;
  updated_at?: string;
  username: string;
  email?: string;
  section?: string | null;
}

export interface ExistingSubmission {
  id: number | string;
  file_path?: string | null;
  original_name?: string | null;
  score?: number | null;
  graded_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// COMMENT TYPES
// ============================================================================

export interface Reply {
  id: string | number;
  username?: string | null;
  reply?: string;
  created_at?: string | null;
  createdAt?: string | null;
  [key: string]: any;
}

export interface Comment {
  id: string | number;
  user_id?: string | number;
  username?: string | null;
  authorName?: string | null;
  comment?: string;
  text?: string;
  created_at?: string | null;
  createdAt?: string | null;
  replies?: Reply[];
  [key: string]: any;
}

// ============================================================================
// ACTIVITY TYPES
// ============================================================================

export interface Activity {
  id: string | number;
  title?: string;
  instructions?: string | Instruction[];
  instruction_text?: string;
  original_name?: string | null;
  file_path?: string | null;
  mime_type?: string | null;
  classroom_code?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  updated_at?: string | null;
  [key: string]: any;
}

// Normalized activities (always has strings intructions)
export type NormalizedActivity = Omit<Activity, "instructions"> & {
  instructions: string;
};

// ============================================================================
// COMPONENT PROPS TYPES
// ============================================================================

export interface TeacherInstructionsProps {
  activityId: string | number;
  currentInstructions?: Instruction[];
  onSaved?: (newInstructions: Instruction[]) => void;
}

export interface ActivitySubmissionsProps {
  submissions: Submission[];
  loading: boolean;
  maxScore: number;
  activityId: string | number;
  onScoreUpdate?: (submissionId: string | number, newScore: number) => void;
}

export interface ActivityCommentsProps {
  activityId: string | number;
}

export interface AnswerSubmissionProps {
  activityId: string | number;
  onSubmitted?: () => void;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ActivityApiResponse {
  success?: boolean;
  activity?: Activity | null;
  activities?: Activity[];
  message?: string;
  error?: string;
}

export interface SubmissionApiResponse {
  success?: boolean;
  submission?: Submission | ExistingSubmission | null;
  submissions?: Submission[];
  maxScore?: number;
  message?: string;
  error?: string;
}

export interface CommentApiResponse {
  success?: boolean;
  comment?: Comment | null;
  comments?: Comment[];
  reply?: Reply | null;
  message?: string;
  error?: string;
}

export interface InstructionApiResponse {
  success?: boolean;
  instruction?: Instruction | null;
  instructions?: Instruction[];
  message?: string;
  error?: string;
}
