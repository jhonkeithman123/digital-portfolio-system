import type { Response } from "express";
import type { AuthRequest } from "middleware/auth";
import { getSupabaseClient } from "../supabase/client";

type ClassroomRow = {
  id: number;
  name: string;
  code: string;
  section: string | null;
};

type SubmissionRow = {
  id: number;
  activity_id: number;
  student_id: number;
  score: number | null;
  created_at: string;
  graded_at: string | null;
};

type UserRow = {
  id: number;
  username: string;
  email: string;
  section: string | null;
};

const asIso = (value: string | null) => value;

const getUserActivities = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  const userId = req.user!.userId;
  const userRole = req.user!.role;

  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const supabase = getSupabaseClient();

    if (userRole === "student") {
      const { data: memberships, error: memberError } = await supabase
        .from("classroom_members")
        .select("classroom_id")
        .eq("student_id", userId)
        .eq("status", "accepted");

      if (memberError) throw memberError;

      const classroomIds = (memberships || []).map((m) => m.classroom_id);
      if (!classroomIds.length) {
        return res.json({ success: true, activities: [] });
      }

      const [
        { data: classrooms, error: classErr },
        { data: activities, error: actErr },
      ] = await Promise.all([
        supabase
          .from("classrooms")
          .select("id, name, code, section")
          .in("id", classroomIds),
        supabase
          .from("activities")
          .select(
            "id, classroom_id, teacher_id, title, file_path, original_name, mime_type, created_at, due_date, max_score",
          )
          .in("classroom_id", classroomIds),
      ]);

      if (classErr) throw classErr;
      if (actErr) throw actErr;

      const activityIds = (activities || []).map((a) => a.id);
      const { data: submissions, error: subErr } = await supabase
        .from("activity_submissions")
        .select("id, activity_id, student_id, score, created_at, graded_at")
        .eq("student_id", userId)
        .in("activity_id", activityIds.length ? activityIds : [-1]);

      if (subErr) throw subErr;

      const classroomById = new Map<number, ClassroomRow>();
      (classrooms || []).forEach((c) =>
        classroomById.set(c.id, c as ClassroomRow),
      );

      const submissionByActivityId = new Map<number, SubmissionRow>();
      (submissions || []).forEach((s) =>
        submissionByActivityId.set(s.activity_id, s as SubmissionRow),
      );

      const now = new Date();
      const mapped = (activities || [])
        .map((a) => {
          const submission = submissionByActivityId.get(a.id);
          const classroom = classroomById.get(a.classroom_id);
          const due = a.due_date ? new Date(a.due_date) : null;

          const status = submission?.graded_at
            ? "graded"
            : submission?.id
              ? "completed"
              : due && due < now
                ? "overdue"
                : "pending";

          return {
            id: a.id,
            title: a.title,
            description: a.file_path,
            type: "activity",
            score: submission?.score ?? null,
            completedAt:
              submission?.created_at || submission?.graded_at || null,
            status,
            className: classroom?.name || null,
            classSection: classroom?.section || null,
            dueDate: asIso(a.due_date),
            createdAt: a.created_at,
            totalSubmissions: 0,
            gradedCount: 0,
            averageScore: null,
          };
        })
        .sort((a, b) => {
          const ad = a.dueDate
            ? new Date(a.dueDate).getTime()
            : Number.MAX_SAFE_INTEGER;
          const bd = b.dueDate
            ? new Date(b.dueDate).getTime()
            : Number.MAX_SAFE_INTEGER;
          if (ad !== bd) return ad - bd;
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });

      return res.json({ success: true, activities: mapped });
    }

    if (userRole === "teacher") {
      const { data: activities, error: actErr } = await supabase
        .from("activities")
        .select(
          "id, classroom_id, teacher_id, title, file_path, original_name, mime_type, created_at, due_date, max_score",
        )
        .eq("teacher_id", userId);

      if (actErr) throw actErr;

      const classroomIds = [
        ...new Set((activities || []).map((a) => a.classroom_id)),
      ];
      const activityIds = (activities || []).map((a) => a.id);

      const [
        { data: classrooms, error: classErr },
        { data: submissions, error: subErr },
      ] = await Promise.all([
        supabase
          .from("classrooms")
          .select("id, name, code, section")
          .in("id", classroomIds.length ? classroomIds : [-1]),
        supabase
          .from("activity_submissions")
          .select("id, activity_id, score, graded_at")
          .in("activity_id", activityIds.length ? activityIds : [-1]),
      ]);

      if (classErr) throw classErr;
      if (subErr) throw subErr;

      const classroomById = new Map<number, ClassroomRow>();
      (classrooms || []).forEach((c) =>
        classroomById.set(c.id, c as ClassroomRow),
      );

      const statsByActivityId = new Map<
        number,
        { total: number; graded: number; scoreSum: number; scoreCount: number }
      >();

      (submissions || []).forEach((s) => {
        const current = statsByActivityId.get(s.activity_id) || {
          total: 0,
          graded: 0,
          scoreSum: 0,
          scoreCount: 0,
        };
        current.total += 1;
        if (s.graded_at) current.graded += 1;
        if (typeof s.score === "number") {
          current.scoreSum += s.score;
          current.scoreCount += 1;
        }
        statsByActivityId.set(s.activity_id, current);
      });

      const mapped = (activities || []).map((a) => {
        const classroom = classroomById.get(a.classroom_id);
        const stats =
          statsByActivityId.get(a.id) ||
          ({ total: 0, graded: 0, scoreSum: 0, scoreCount: 0 } as const);

        return {
          id: a.id,
          title: a.title,
          description: a.file_path,
          type: "activity",
          score: null,
          completedAt: null,
          status: "created",
          className: classroom?.name || null,
          classSection: classroom?.section || null,
          dueDate: asIso(a.due_date),
          createdAt: a.created_at,
          totalSubmissions: stats.total,
          gradedCount: stats.graded,
          averageScore:
            stats.scoreCount > 0
              ? (stats.scoreSum / stats.scoreCount).toFixed(1)
              : null,
        };
      });

      return res.json({ success: true, activities: mapped });
    }

    return res.json({ success: true, activities: [] });
  } catch (error) {
    console.error("[PORTFOLIO SUPABASE] getUserActivities:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load activities",
    });
  }
};

const getActivityDetails = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const userRole = req.user!.role;

  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const supabase = getSupabaseClient();

    const { data: activity, error: activityErr } = await supabase
      .from("activities")
      .select(
        "id, classroom_id, teacher_id, title, file_path, original_name, mime_type, created_at, due_date, max_score",
      )
      .eq("id", Number(id))
      .maybeSingle();

    if (activityErr) throw activityErr;
    if (!activity) {
      return res
        .status(404)
        .json({ success: false, message: "Activity not found" });
    }

    if (userRole === "student") {
      const { data: enrolled, error: enrollErr } = await supabase
        .from("classroom_members")
        .select("classroom_id")
        .eq("classroom_id", activity.classroom_id)
        .eq("student_id", userId)
        .eq("status", "accepted")
        .limit(1)
        .maybeSingle();

      if (enrollErr) throw enrollErr;
      if (!enrolled) {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }
    } else if (userRole === "teacher" && activity.teacher_id !== userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const [
      { data: classroom, error: classErr },
      { data: teacher, error: teacherErr },
    ] = await Promise.all([
      supabase
        .from("classrooms")
        .select("id, name, code, section")
        .eq("id", activity.classroom_id)
        .maybeSingle(),
      supabase
        .from("users")
        .select("username")
        .eq("id", activity.teacher_id)
        .maybeSingle(),
    ]);

    if (classErr) throw classErr;
    if (teacherErr) throw teacherErr;

    return res.json({
      success: true,
      activity: {
        ...activity,
        classroomName: classroom?.name || null,
        classroomCode: classroom?.code || null,
        classSection: classroom?.section || null,
        teacherName: teacher?.username || null,
      },
    });
  } catch (error) {
    console.error("[PORTFOLIO SUPABASE] getActivityDetails:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getActivitySubmission = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  const { id } = req.params;
  const activityId = Number(id);
  const userId = req.user!.userId;
  const userRole = req.user!.role;

  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const supabase = getSupabaseClient();

    if (userRole === "student") {
      const [
        { data: submission, error: subErr },
        { data: activity, error: actErr },
      ] = await Promise.all([
        supabase
          .from("activity_submissions")
          .select("id, activity_id, student_id, score, created_at, graded_at")
          .eq("activity_id", activityId)
          .eq("student_id", userId)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("activities")
          .select("title")
          .eq("id", activityId)
          .limit(1)
          .maybeSingle(),
      ]);

      if (subErr) throw subErr;
      if (actErr) throw actErr;

      return res.json({
        success: true,
        submission: submission
          ? {
              ...submission,
              activityTitle: activity?.title || null,
            }
          : null,
      });
    }

    if (userRole === "teacher") {
      const { data: activity, error: actErr } = await supabase
        .from("activities")
        .select("id, teacher_id")
        .eq("id", activityId)
        .limit(1)
        .maybeSingle();

      if (actErr) throw actErr;
      if (!activity || activity.teacher_id !== userId) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      const { data: submissions, error: subErr } = await supabase
        .from("activity_submissions")
        .select("id, activity_id, student_id, score, created_at, graded_at")
        .eq("activity_id", activityId)
        .order("created_at", { ascending: false });

      if (subErr) throw subErr;

      const studentIds = [
        ...new Set((submissions || []).map((s) => s.student_id)),
      ];
      const { data: students, error: stuErr } = await supabase
        .from("users")
        .select("id, username, email, section")
        .in("id", studentIds.length ? studentIds : [-1]);

      if (stuErr) throw stuErr;

      const studentById = new Map<number, UserRow>();
      (students || []).forEach((s) => studentById.set(s.id, s as UserRow));

      const merged = (submissions || []).map((s) => ({
        ...s,
        studentName: studentById.get(s.student_id)?.username || null,
        studentEmail: studentById.get(s.student_id)?.email || null,
        studentSection: studentById.get(s.student_id)?.section || null,
      }));

      return res.json({ success: true, submissions: merged });
    }

    return res.status(403).json({ success: false, message: "Forbidden" });
  } catch (error) {
    console.error("[PORTFOLIO SUPABASE] getActivitySubmission:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const controller = {
  getUserActivities,
  getActivityDetails,
  getActivitySubmission,
};

export default controller;
