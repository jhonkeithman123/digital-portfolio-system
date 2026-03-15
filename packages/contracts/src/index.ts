export type ApiMessageType = "info" | "success" | "error";

export interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  error?: string;
  data?: T;
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  unauthorized?: boolean;
}

export type UserRole = "student" | "teacher";

export interface SessionUser {
  id?: string | number;
  ID?: string | number;
  role?: UserRole;
  username?: string;
  name?: string;
  email?: string;
  section?: string | null;
  grade?: string | null;
}

export interface SessionResponse {
  success?: boolean;
  user?: SessionUser | null;
  error?: string;
  message?: string;
}

export type {
  DbActivity,
  DbActivitySubmission,
  DbClassroom,
  DbUser,
} from "./database";
