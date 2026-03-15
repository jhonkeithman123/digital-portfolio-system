// Placeholder until generated from Supabase CLI.
// Run: pnpm --filter @digital-portfolio/server supabase:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: number;
          email: string;
          username: string;
          section: string | null;
          student_number: string | null;
          grade: string | null;
          password: string;
          role: string;
          verification_code: string | null;
          verification_expiry: string | null;
          is_verified: boolean | null;
        };
        Insert: {
          id?: never;
          email: string;
          username: string;
          section?: string | null;
          student_number?: string | null;
          grade?: string | null;
          password: string;
          role: string;
          verification_code?: string | null;
          verification_expiry?: string | null;
          is_verified?: boolean | null;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      classrooms: {
        Row: {
          id: number;
          name: string;
          section: string | null;
          grade: string | null;
          code: string;
          teacher_id: number;
          created_at: string;
          school_year: string;
          updated_at: string | null;
        };
        Insert: {
          id?: never;
          name: string;
          section?: string | null;
          grade?: string | null;
          code: string;
          teacher_id: number;
          created_at?: string;
          school_year: string;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["classrooms"]["Insert"]>;
      };
      activities: {
        Row: {
          id: number;
          classroom_id: number;
          teacher_id: number;
          title: string;
          file_path: string | null;
          original_name: string | null;
          mime_type: string | null;
          max_score: number | null;
          created_at: string;
          due_date: string | null;
        };
        Insert: {
          id?: never;
          classroom_id: number;
          teacher_id: number;
          title: string;
          file_path?: string | null;
          original_name?: string | null;
          mime_type?: string | null;
          max_score?: number | null;
          created_at?: string;
          due_date?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["activities"]["Insert"]>;
      };
    };
  };
}
