declare global {
  interface Window {
    hackedFunction?: unknown;
    __injected__?: unknown;
  }
}

const validRoles = ["student", "teacher"] as const;
export type Role = (typeof validRoles)[number];
export type MessageType = "info" | "success" | "error";
export type ShowMessageFn = (text: string, kind?: MessageType) => void;

export interface Reply {
  id: string;
  username?: string;
  reply?: string;
  created_at?: string;
}

export interface Comment {
  id: string;
  username?: string;
  comment?: string;
  created_at?: string;
  replies?: Reply[];
}

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

export interface Quiz {
  id: string;
  title?: string;
}

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
