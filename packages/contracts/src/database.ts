export interface DbUser {
  id: number;
  email: string;
  username: string;
  section: string | null;
  studentNumber: string | null;
  grade: string | null;
  role: "student" | "teacher";
  verificationCode: string | null;
  verificationExpiry: string | null;
  isVerified: boolean;
}

export interface DbClassroom {
  id: number;
  name: string;
  section: string | null;
  grade: string | null;
  code: string;
  teacherId: number;
  schoolYear: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface DbActivity {
  id: number;
  classroomId: number;
  teacherId: number;
  title: string;
  filePath: string | null;
  originalName: string | null;
  mimeType: string | null;
  maxScore: number;
  createdAt: string;
  dueDate: string | null;
}

export interface DbActivitySubmission {
  id: number;
  activityId: number;
  studentId: number;
  filePath: string | null;
  originalName: string | null;
  mimeType: string | null;
  score: number | null;
  gradedAt: string | null;
  gradedBy: number | null;
  createdAt: string;
  updatedAt: string;
}
