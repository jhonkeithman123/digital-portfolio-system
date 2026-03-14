import { z } from "zod";

export const userRoleSchema = z.enum(["student", "teacher"]);

export const userSchema = z.object({
  id: z.number().int().positive(),
  email: z.email(),
  username: z.string().min(1).max(255),
  section: z.string().max(64).nullable(),
  student_number: z.string().nullable(),
  grade: z.string().max(2).nullable(),
  role: userRoleSchema,
  verification_code: z.string().length(6).nullable(),
  verification_expiry: z.string().datetime({ offset: true }).nullable(),
  is_verified: z.boolean().nullable(),
});

export const classroomSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  section: z.string().max(64).nullable(),
  grade: z.string().max(64).nullable(),
  code: z.string().min(1).max(10),
  teacher_id: z.number().int().positive(),
  school_year: z.string().max(20),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }).nullable(),
});

export const activitySchema = z.object({
  id: z.number().int().positive(),
  classroom_id: z.number().int().positive(),
  teacher_id: z.number().int().positive(),
  title: z.string().min(1).max(150),
  file_path: z.string().nullable(),
  original_name: z.string().nullable(),
  mime_type: z.string().max(100).nullable(),
  max_score: z.number().int().nullable(),
  created_at: z.string().datetime({ offset: true }),
  due_date: z.string().datetime({ offset: true }).nullable(),
});

export type UserSchema = z.infer<typeof userSchema>;
export type ClassroomSchema = z.infer<typeof classroomSchema>;
export type ActivitySchema = z.infer<typeof activitySchema>;
