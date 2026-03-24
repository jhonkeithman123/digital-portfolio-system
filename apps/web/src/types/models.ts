declare global {
  interface Window {
    hackedFunction?: unknown;
    __injected__?: unknown;
  }
}

import type { Comment } from "./activity";

const validRoles = ["student", "teacher"] as const;
export type Role = (typeof validRoles)[number];
export interface RoleColors {
  student: string;
  teacher: string;
}

export type MessageType = "info" | "success" | "error";
export type ShowMessageFn = (text: string, kind?: MessageType) => void;

export const ALLOWED_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "protonmail.com",
  "aol.com",
  "zoho.com",
  "mail.com",
  "yandex.com",
];

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
  grade?: string | null;
  studentNumber?: string | null;
  onlineStatus?: "online" | "offline" | "unknown";
  role?: string; // Added for admin UI to distinguish teachers
}

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
  grade?: string | null;
  username?: string;
  email?: string;
  isAdmin?: boolean;
}

export interface ClassroomInfo {
  id?: string;
  name?: string;
  code?: string | null;
  section?: string | null;
  grade?: string | null;
}

export interface TamperGuardOptions {
  intervalMs?: number;
  enabled?: boolean;
  redirect?: string;
  logoutUrl?: string;
}
