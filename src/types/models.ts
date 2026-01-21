declare global {
  interface Window {
    hackedFunction?: unknown;
    __injected__?: unknown;
  }
}

import type { Comment } from "./activity";

const validRoles = ["student", "teacher"] as const;
export type Role = (typeof validRoles)[number];
export type MessageType = "info" | "success" | "error";
export type ShowMessageFn = (text: string, kind?: MessageType) => void;

export interface ShowcaseItem {
  id: string;
  studentName?: string;
  showcasedAt?: string | null;
  score?: number | null;
  activityName?: string | null;
  fileUrl?: string | null;
  comments?: Comment[];
}

export interface Student {
  id: string;
  username?: string;
  email?: string;
  section?: string | null;
}

// Re-export Quiz types from quiz.d.ts
export type { Quiz, QuizAttempt, Question, Page } from "./quiz";

// Re-export Activity types from activity.d.ts
export type {
  Activity,
  Instruction,
  Submission,
  Comment,
  Reply,
} from "./activity";

export interface User {
  id: string;
  role: "student" | "teacher";
  section?: string | null;
  username?: string;
  email?: string;
}

export interface ClassroomInfo {
  id?: string;
  name?: string;
  code?: string | null;
  section?: string | null;
}

export interface TamperGuardOptions {
  intervalMs?: number;
  enabled?: boolean;
  redirect?: string;
  logoutUrl?: string;
}
