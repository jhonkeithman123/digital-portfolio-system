import type { Request, Response } from "express";
import path from "path";
import fs from "fs/promises";
import multer, { type FileFilterCallback } from "multer";
import type { AuthRequest } from "../middleware/auth.js";
import { getSupabaseClient } from "../supabase/client.js";

interface AuthResult {
  ok: boolean;
  reason?: string;
  activity?: {
    id: number;
    classroom_id: number;
    teacher_id: number;
    title: string;
    max_score: number | null;
  };
}

const uploadDir = path.join(process.cwd(), "uploads", "activities");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const base = file.originalname.replace(/\s+/g, "_");
    cb(null, `${ts}__${base}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Invalid file type"));
    }
    cb(null, true);
  },
});

async function authorizeActivity(
  activityId: string | number | string[],
  userId: number,
  role: string,
): Promise<AuthResult> {
  const supabase = getSupabaseClient();
  const activityIdNum = Number(
    Array.isArray(activityId) ? activityId[0] : activityId,
  );

  if (!Number.isFinite(activityIdNum)) {
    return { ok: false, reason: "Activity not found" };
  }

  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select("id, classroom_id, teacher_id, title, max_score")
    .eq("id", activityIdNum)
    .limit(1)
    .maybeSingle();

  if (activityError) throw activityError;
  if (!activity) return { ok: false, reason: "Activity not found" };

  if (role === "teacher") {
    if (activity.teacher_id !== userId) {
      return { ok: false, reason: "Forbidden" };
    }
  } else {
    const { data: member, error: memberError } = await supabase
      .from("classroom_members")
      .select("id")
      .eq("classroom_id", activity.classroom_id)
      .eq("student_id", userId)
      .eq("status", "accepted")
      .limit(1)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!member) return { ok: false, reason: "Forbidden" };
  }

  return { ok: true, activity };
}

const getActivityById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

  try {
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    const supabase = getSupabaseClient();
    const activityId = Number(id);

    const [
      { data: activity, error: activityError },
      { data: instructions, error: instrError },
    ] = await Promise.all([
      supabase
        .from("activities")
        .select(
          "id, classroom_id, teacher_id, title, file_path, original_name, mime_type, created_at, due_date, max_score",
        )
        .eq("id", activityId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("activity_instructions")
        .select(
          "id, activity_id, teacher_id, instruction_text, created_at, updated_at",
        )
        .eq("activity_id", activityId)
        .order("created_at", { ascending: true }),
    ]);

    if (activityError) throw activityError;
    if (instrError) throw instrError;

    if (!activity) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    const [
      { data: classroom, error: classroomError },
      { data: teachers, error: teacherError },
    ] = await Promise.all([
      supabase
        .from("classrooms")
        .select("code")
        .eq("id", activity.classroom_id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("users")
        .select("id, username, role")
        .in(
          "id",
          (instructions || []).map((i) => i.teacher_id).length
            ? [...new Set((instructions || []).map((i) => i.teacher_id))]
            : [-1],
        ),
    ]);

    if (classroomError) throw classroomError;
    if (teacherError) throw teacherError;

    const teacherMap = new Map<number, { username: string; role: string }>();
    (teachers || []).forEach((t) =>
      teacherMap.set(t.id, { username: t.username, role: t.role }),
    );

    const formattedInstructions = (instructions || []).map((i) => ({
      ...i,
      username: teacherMap.get(i.teacher_id)?.username || "Unknown",
      teacher_role: teacherMap.get(i.teacher_id)?.role || "teacher",
    }));

    return res.json({
      success: true,
      activity: {
        ...activity,
        classroom_code: classroom?.code || null,
        instructions: formattedInstructions,
      },
    });
  } catch (error) {
    console.error("[ACTIVITY SUPABASE] getActivityById:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const deleteActivity = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

  if (role !== "teacher") {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  try {
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("activities")
      .delete()
      .eq("id", Number(id));
    if (error) throw error;

    return res.json({ success: true, message: "Activity deleted" });
  } catch (error) {
    console.error("[ACTIVITY SUPABASE] deleteActivity:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const getActivityComments = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

  try {
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    const supabase = getSupabaseClient();

    const { data: comments, error: commentsError } = await supabase
      .from("comments")
      .select(
        "id, activity_id, classroom_id, user_id, comment, created_at, updated_at, edited",
      )
      .eq("activity_id", Number(id))
      .eq("classroom_id", auth.activity!.classroom_id)
      .order("created_at", { ascending: true });

    if (commentsError) throw commentsError;

    const commentIds = (comments || []).map((c) => c.id);
    const userIds = [...new Set((comments || []).map((c) => c.user_id))];

    const [
      { data: replies, error: repliesError },
      { data: commentUsers, error: usersError },
    ] = await Promise.all([
      supabase
        .from("comment_replies")
        .select(
          "id, comment_id, user_id, reply, created_at, updated_at, edited",
        )
        .in("comment_id", commentIds.length ? commentIds : [-1])
        .order("created_at", { ascending: true }),
      supabase
        .from("users")
        .select("id, username, role")
        .in("id", userIds.length ? userIds : [-1]),
    ]);

    if (repliesError) throw repliesError;
    if (usersError) throw usersError;

    const replyUserIds = [...new Set((replies || []).map((r) => r.user_id))];
    const missingReplyUsers = replyUserIds.filter(
      (idv) => !userIds.includes(idv),
    );

    let replyUsers: { id: number; username: string; role: string }[] = [];
    if (missingReplyUsers.length) {
      const { data, error } = await supabase
        .from("users")
        .select("id, username, role")
        .in("id", missingReplyUsers);
      if (error) throw error;
      replyUsers = data || [];
    }

    const userMap = new Map<number, { username: string; role: string }>();
    [...(commentUsers || []), ...replyUsers].forEach((u) =>
      userMap.set(u.id, { username: u.username, role: u.role }),
    );

    const repliesByComment = new Map<number, any[]>();
    (replies || []).forEach((r) => {
      const enriched = {
        ...r,
        username: userMap.get(r.user_id)?.username || "Unknown",
        role: userMap.get(r.user_id)?.role || "student",
      };
      const list = repliesByComment.get(r.comment_id) || [];
      list.push(enriched);
      repliesByComment.set(r.comment_id, list);
    });

    const payload = (comments || []).map((c) => ({
      ...c,
      username: userMap.get(c.user_id)?.username || "Unknown",
      role: userMap.get(c.user_id)?.role || "student",
      replies: repliesByComment.get(c.id) || [],
    }));

    return res.json({ success: true, comments: payload });
  } catch (error) {
    console.error("[ACTIVITY SUPABASE] getActivityComments:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const createComment = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;
  const { comment } = req.body;

  if (typeof comment !== "string" || !comment.trim()) {
    return res
      .status(400)
      .json({ success: false, error: "Comment text are required" });
  }

  try {
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    const supabase = getSupabaseClient();
    const safe = comment.trim().slice(0, 255);

    const { data: inserted, error: insertError } = await supabase
      .from("comments")
      .insert({
        classroom_id: auth.activity!.classroom_id,
        activity_id: Number(id),
        user_id: userId,
        comment: safe,
      })
      .select(
        "id, activity_id, classroom_id, user_id, comment, created_at, updated_at, edited",
      )
      .single();

    if (insertError) throw insertError;

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("username, role")
      .eq("id", userId)
      .limit(1)
      .maybeSingle();

    if (userError) throw userError;

    return res.json({
      success: true,
      comments: {
        ...inserted,
        username: user?.username || "Unknown",
        role: user?.role || "student",
        replies: [],
      },
      message: "Comment added",
    });
  } catch (error) {
    console.error("[ACTIVITY SUPABASE] createComment:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const deleteComment = async (req: AuthRequest, res: Response) => {
  const { id, commentId } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

  try {
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    const supabase = getSupabaseClient();
    const numericId = Number(commentId);

    const { data: comment, error: commentError } = await supabase
      .from("comments")
      .select("id, user_id")
      .eq("id", numericId)
      .eq("activity_id", Number(id))
      .limit(1)
      .maybeSingle();

    if (commentError) throw commentError;

    if (comment) {
      if (comment.user_id !== userId) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", numericId);
      if (error) throw error;
      return res.json({ success: true, message: "Comment deleted" });
    }

    const { data: reply, error: replyError } = await supabase
      .from("comment_replies")
      .select("id, user_id, comment_id")
      .eq("id", numericId)
      .limit(1)
      .maybeSingle();

    if (replyError) throw replyError;

    if (!reply) {
      return res
        .status(404)
        .json({ success: false, error: "Comment or reply not found" });
    }

    const { data: parentComment, error: parentError } = await supabase
      .from("comments")
      .select("activity_id")
      .eq("id", reply.comment_id)
      .limit(1)
      .maybeSingle();

    if (parentError) throw parentError;
    if (!parentComment || parentComment.activity_id !== Number(id)) {
      return res
        .status(404)
        .json({ success: false, error: "Comment or reply not found" });
    }

    if (reply.user_id !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const { error } = await supabase
      .from("comment_replies")
      .delete()
      .eq("id", numericId);
    if (error) throw error;

    return res.json({ success: true, message: "Reply deleted" });
  } catch (error) {
    console.error("[ACTIVITY SUPABASE] deleteComment:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const createReply = async (req: AuthRequest, res: Response) => {
  const { id, commentId } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;
  const { reply } = req.body;

  if (typeof reply !== "string" || !reply.trim()) {
    return res
      .status(400)
      .json({ success: false, error: "Reply cannot be empty" });
  }

  try {
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    const supabase = getSupabaseClient();

    const { data: parent, error: parentError } = await supabase
      .from("comments")
      .select("id")
      .eq("id", Number(commentId))
      .eq("activity_id", Number(id))
      .limit(1)
      .maybeSingle();

    if (parentError) throw parentError;
    if (!parent) {
      return res
        .status(404)
        .json({ success: false, error: "Comment not found" });
    }

    const safe = reply.trim().slice(0, 255);

    const { data: inserted, error: insertError } = await supabase
      .from("comment_replies")
      .insert({
        comment_id: Number(commentId),
        user_id: userId,
        reply: safe,
      })
      .select("id, comment_id, user_id, reply, created_at, updated_at, edited")
      .single();

    if (insertError) throw insertError;

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("username, role")
      .eq("id", userId)
      .limit(1)
      .maybeSingle();

    if (userError) throw userError;

    return res.json({
      success: true,
      reply: {
        ...inserted,
        username: user?.username || "Unknown",
        role: user?.role || "student",
      },
      message: "Reply added",
    });
  } catch (error) {
    console.error("[ACTIVITY SUPABASE] createReply:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const deleteReply = async (req: AuthRequest, res: Response) => {
  const { id, commentId, replyId } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

  try {
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    const supabase = getSupabaseClient();

    const { data: reply, error: replyError } = await supabase
      .from("comment_replies")
      .select("id, user_id, comment_id")
      .eq("id", Number(replyId))
      .eq("comment_id", Number(commentId))
      .limit(1)
      .maybeSingle();

    if (replyError) throw replyError;
    if (!reply) {
      return res.status(404).json({ success: false, error: "Reply not found" });
    }

    const { data: parent, error: parentError } = await supabase
      .from("comments")
      .select("id, activity_id")
      .eq("id", reply.comment_id)
      .limit(1)
      .maybeSingle();

    if (parentError) throw parentError;
    if (!parent || parent.activity_id !== Number(id)) {
      return res.status(404).json({ success: false, error: "Reply not found" });
    }

    if (reply.user_id !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const { error } = await supabase
      .from("comment_replies")
      .delete()
      .eq("id", reply.id);
    if (error) throw error;

    return res.json({ success: true, message: "Reply deleted" });
  } catch (error) {
    console.error("[ACTIVITY SUPABASE] deleteReply:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const createActivity = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== "teacher") {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const { title, instructions, classroomCode, max_score, due_date } =
      req.body;
    if (!title || !instructions || !classroomCode) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    const supabase = getSupabaseClient();
    const { data: classroom, error: classroomError } = await supabase
      .from("classrooms")
      .select("id")
      .eq("code", classroomCode)
      .eq("teacher_id", req.user!.userId)
      .limit(1)
      .maybeSingle();

    if (classroomError) throw classroomError;
    if (!classroom) {
      return res
        .status(403)
        .json({ success: false, error: "Invalid classroom code" });
    }

    const file = req.file || null;
    const maxScoreValue = parseInt(max_score, 10) || 100;
    const dueDateValue =
      due_date && !isNaN(new Date(due_date).getTime()) ? due_date : null;

    const { data: created, error: createError } = await supabase
      .from("activities")
      .insert({
        classroom_id: classroom.id,
        teacher_id: req.user!.userId,
        title: String(title).trim(),
        file_path: file ? file.filename : null,
        original_name: file ? file.originalname : null,
        mime_type: file ? file.mimetype : null,
        max_score: maxScoreValue,
        due_date: dueDateValue,
      })
      .select("id")
      .single();

    if (createError) throw createError;

    const trimmedInstructions = String(instructions).trim();
    if (trimmedInstructions) {
      const { error: instrError } = await supabase
        .from("activity_instructions")
        .insert({
          activity_id: created.id,
          teacher_id: req.user!.userId,
          instruction_text: trimmedInstructions.slice(0, 2000),
        });
      if (instrError) throw instrError;
    }

    return res.json({
      success: true,
      id: created.id,
      message: "Activity created",
    });
  } catch (error) {
    console.error("[ACTIVITY SUPABASE] createActivity:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
};

const getClassroomActivities = async (req: AuthRequest, res: Response) => {
  const { code } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

  try {
    const supabase = getSupabaseClient();

    let classroomId: number | null = null;
    if (role === "teacher") {
      const { data: c, error } = await supabase
        .from("classrooms")
        .select("id")
        .eq("code", code)
        .eq("teacher_id", userId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      classroomId = c?.id || null;
    } else {
      const { data: c, error } = await supabase
        .from("classrooms")
        .select("id")
        .eq("code", code)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (c) {
        const { data: member, error: mErr } = await supabase
          .from("classroom_members")
          .select("id")
          .eq("classroom_id", c.id)
          .eq("student_id", userId)
          .eq("status", "accepted")
          .limit(1)
          .maybeSingle();
        if (mErr) throw mErr;
        classroomId = member ? c.id : null;
      }
    }

    if (!classroomId) {
      return res
        .status(403)
        .json({ success: false, error: "Not authorized for this classroom" });
    }

    const { data: activities, error: activitiesError } = await supabase
      .from("activities")
      .select(
        "id, classroom_id, teacher_id, title, file_path, original_name, mime_type, created_at, due_date, max_score",
      )
      .eq("classroom_id", classroomId)
      .order("created_at", { ascending: false });

    if (activitiesError) throw activitiesError;

    return res.json({ success: true, activities: activities || [] });
  } catch (error) {
    console.error("[ACTIVITY SUPABASE] getClassroomActivities:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const submitActivity = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

  if (role !== "student") {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  try {
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    const file = req.file || null;
    if (!file) {
      return res
        .status(400)
        .json({ success: false, error: "Submission must include a file" });
    }

    const supabase = getSupabaseClient();

    const { data: existing, error: existingError } = await supabase
      .from("activity_submissions")
      .select("id")
      .eq("activity_id", Number(id))
      .eq("student_id", userId)
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    let submissionId: number;

    if (existing) {
      submissionId = existing.id;
      const { error: updateError } = await supabase
        .from("activity_submissions")
        .update({
          file_path: file.filename,
          original_name: file.originalname,
          mime_type: file.mimetype,
          updated_at: new Date().toISOString(),
        })
        .eq("id", submissionId);
      if (updateError) throw updateError;
    } else {
      const { data: created, error: createError } = await supabase
        .from("activity_submissions")
        .insert({
          activity_id: Number(id),
          student_id: userId,
          file_path: file.filename,
          original_name: file.originalname,
          mime_type: file.mimetype,
        })
        .select("id")
        .single();
      if (createError) throw createError;
      submissionId = created.id;
    }

    const [
      { data: submission, error: submissionError },
      { data: user, error: userError },
    ] = await Promise.all([
      supabase
        .from("activity_submissions")
        .select(
          "id, activity_id, student_id, file_path, original_name, mime_type, score, graded_at, graded_by, created_at, updated_at",
        )
        .eq("id", submissionId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("users")
        .select("username, email, section")
        .eq("id", userId)
        .limit(1)
        .maybeSingle(),
    ]);

    if (submissionError) throw submissionError;
    if (userError) throw userError;

    return res.json({
      success: true,
      message: existing ? "Submission updated" : "Submission created",
      submission: {
        ...submission,
        username: user?.username || null,
        email: user?.email || null,
        section: user?.section || null,
      },
    });
  } catch (error) {
    console.error("[ACTIVITY SUPABASE] submitActivity:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const updateInstructions = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { instructions } = req.body;
  const userId = req.user!.userId;
  const role = req.user!.role;

  if (role !== "teacher") {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  if (typeof instructions !== "string" || !instructions.trim()) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid instructions" });
  }

  try {
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    const supabase = getSupabaseClient();
    const safe = instructions.trim().slice(0, 2000);

    const { error: insertError } = await supabase
      .from("activity_instructions")
      .insert({
        activity_id: Number(id),
        teacher_id: userId,
        instruction_text: safe,
      });

    if (insertError) throw insertError;

    const { data: allInstructions, error: instructionsError } = await supabase
      .from("activity_instructions")
      .select(
        "id, activity_id, teacher_id, instruction_text, created_at, updated_at",
      )
      .eq("activity_id", Number(id))
      .order("created_at", { ascending: true });

    if (instructionsError) throw instructionsError;

    const teacherIds = [
      ...new Set((allInstructions || []).map((i) => i.teacher_id)),
    ];
    const { data: teachers, error: teachersError } = await supabase
      .from("users")
      .select("id, username, role")
      .in("id", teacherIds.length ? teacherIds : [-1]);

    if (teachersError) throw teachersError;

    const teacherMap = new Map<number, { username: string; role: string }>();
    (teachers || []).forEach((t) =>
      teacherMap.set(t.id, { username: t.username, role: t.role }),
    );

    return res.json({
      success: true,
      message: "Instruction added",
      instructions: (allInstructions || []).map((i) => ({
        ...i,
        username: teacherMap.get(i.teacher_id)?.username || "Unknown",
        teacher_role: teacherMap.get(i.teacher_id)?.role || "teacher",
      })),
    });
  } catch (error) {
    console.error("[ACTIVITY SUPABASE] updateInstructions:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const editInstruction = async (req: AuthRequest, res: Response) => {
  const { id, instructionId } = req.params;
  const { instruction_text } = req.body;
  const userId = req.user!.userId;
  const role = req.user!.role;

  if (role !== "teacher") {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  if (typeof instruction_text !== "string" || !instruction_text.trim()) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid instruction text" });
  }

  try {
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    const supabase = getSupabaseClient();

    const { data: instr, error: instrCheckError } = await supabase
      .from("activity_instructions")
      .select("id")
      .eq("id", Number(instructionId))
      .eq("activity_id", Number(id))
      .limit(1)
      .maybeSingle();

    if (instrCheckError) throw instrCheckError;
    if (!instr) {
      return res
        .status(404)
        .json({ success: false, error: "Instruction not found" });
    }

    const safe = instruction_text.trim().slice(0, 2000);
    const { error: updateError } = await supabase
      .from("activity_instructions")
      .update({ instruction_text: safe, updated_at: new Date().toISOString() })
      .eq("id", Number(instructionId));

    if (updateError) throw updateError;

    const { data: allInstructions, error: instructionsError } = await supabase
      .from("activity_instructions")
      .select(
        "id, activity_id, teacher_id, instruction_text, created_at, updated_at",
      )
      .eq("activity_id", Number(id))
      .order("created_at", { ascending: true });

    if (instructionsError) throw instructionsError;

    const teacherIds = [
      ...new Set((allInstructions || []).map((i) => i.teacher_id)),
    ];
    const { data: teachers, error: teachersError } = await supabase
      .from("users")
      .select("id, username, role")
      .in("id", teacherIds.length ? teacherIds : [-1]);

    if (teachersError) throw teachersError;

    const teacherMap = new Map<number, { username: string; role: string }>();
    (teachers || []).forEach((t) =>
      teacherMap.set(t.id, { username: t.username, role: t.role }),
    );

    return res.json({
      success: true,
      message: "Instruction updated",
      instructions: (allInstructions || []).map((i) => ({
        ...i,
        username: teacherMap.get(i.teacher_id)?.username || "Unknown",
        teacher_role: teacherMap.get(i.teacher_id)?.role || "teacher",
      })),
    });
  } catch (error) {
    console.error("[ACTIVITY SUPABASE] editInstruction:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const editComment = async (req: AuthRequest, res: Response) => {
  const { id, commentId } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;
  const { comment } = req.body;

  if (typeof comment !== "string" || !comment.trim()) {
    return res.status(400).json({ success: false, error: "Invalid comment" });
  }

  try {
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    const supabase = getSupabaseClient();
    const numericCommentId = Number(commentId);
    const safe = comment.trim().slice(0, 255);

    const { data: existingComment, error: commentError } = await supabase
      .from("comments")
      .select("id, user_id")
      .eq("id", numericCommentId)
      .eq("activity_id", Number(id))
      .limit(1)
      .maybeSingle();

    if (commentError) throw commentError;

    if (existingComment) {
      if (existingComment.user_id !== userId) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      const { error: updateError } = await supabase
        .from("comments")
        .update({
          comment: safe,
          edited: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", numericCommentId);

      if (updateError) throw updateError;

      const [
        { data: updated, error: updatedError },
        { data: user, error: userError },
      ] = await Promise.all([
        supabase
          .from("comments")
          .select(
            "id, activity_id, classroom_id, user_id, comment, created_at, updated_at, edited",
          )
          .eq("id", numericCommentId)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("users")
          .select("username, role")
          .eq("id", userId)
          .limit(1)
          .maybeSingle(),
      ]);

      if (updatedError) throw updatedError;
      if (userError) throw userError;

      return res.json({
        success: true,
        type: "comment",
        comment: {
          ...updated,
          username: user?.username || "Unknown",
          role: user?.role || "student",
        },
        message: "Comment updated",
      });
    }

    const { data: existingReply, error: replyError } = await supabase
      .from("comment_replies")
      .select("id, user_id, comment_id")
      .eq("id", numericCommentId)
      .limit(1)
      .maybeSingle();

    if (replyError) throw replyError;

    if (!existingReply) {
      return res
        .status(404)
        .json({ success: false, error: "Comment or reply not found" });
    }

    const { data: parentComment, error: parentError } = await supabase
      .from("comments")
      .select("id, activity_id")
      .eq("id", existingReply.comment_id)
      .limit(1)
      .maybeSingle();

    if (parentError) throw parentError;
    if (!parentComment || parentComment.activity_id !== Number(id)) {
      return res
        .status(404)
        .json({ success: false, error: "Comment or reply not found" });
    }

    if (existingReply.user_id !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const { error: updateReplyError } = await supabase
      .from("comment_replies")
      .update({
        reply: safe,
        edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", numericCommentId);

    if (updateReplyError) throw updateReplyError;

    const [
      { data: updatedReply, error: updatedReplyError },
      { data: user, error: userError },
    ] = await Promise.all([
      supabase
        .from("comment_replies")
        .select(
          "id, comment_id, user_id, reply, created_at, updated_at, edited",
        )
        .eq("id", numericCommentId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("users")
        .select("username, role")
        .eq("id", userId)
        .limit(1)
        .maybeSingle(),
    ]);

    if (updatedReplyError) throw updatedReplyError;
    if (userError) throw userError;

    return res.json({
      success: true,
      type: "reply",
      reply: {
        ...updatedReply,
        username: user?.username || "Unknown",
        role: user?.role || "student",
      },
      message: "Reply updated",
    });
  } catch (error) {
    console.error("[ACTIVITY SUPABASE] editComment:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const getMySubmission = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

  if (role !== "student") {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  try {
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    const supabase = getSupabaseClient();
    const { data: submission, error } = await supabase
      .from("activity_submissions")
      .select(
        "id, activity_id, student_id, file_path, original_name, mime_type, score, graded_at, graded_by, created_at, updated_at",
      )
      .eq("activity_id", Number(id))
      .eq("student_id", userId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return res.json({ success: true, submission: submission || null });
  } catch (error) {
    console.error("[ACTIVITY SUPABASE] getMySubmission:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const getActivitySubmissions = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

  if (role !== "teacher") {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  try {
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    const supabase = getSupabaseClient();
    const activityId = Number(id);

    const [
      { data: submissions, error: submissionsError },
      { data: users, error: usersError },
    ] = await Promise.all([
      supabase
        .from("activity_submissions")
        .select(
          "id, activity_id, student_id, file_path, original_name, mime_type, score, graded_at, graded_by, created_at, updated_at",
        )
        .eq("activity_id", activityId)
        .order("created_at", { ascending: false }),
      supabase.from("users").select("id, username, email, section"),
    ]);

    if (submissionsError) throw submissionsError;
    if (usersError) throw usersError;

    const userMap = new Map<
      number,
      { username: string; email: string; section: string | null }
    >();
    (users || []).forEach((u) =>
      userMap.set(u.id, {
        username: u.username,
        email: u.email,
        section: u.section,
      }),
    );

    const mapped = (submissions || []).map((s) => ({
      ...s,
      username: userMap.get(s.student_id)?.username || "Unknown",
      email: userMap.get(s.student_id)?.email || "",
      section: userMap.get(s.student_id)?.section || null,
    }));

    const maxScore = auth.activity?.max_score || 100;

    return res.json({ success: true, submissions: mapped, maxScore });
  } catch (error) {
    console.error("[ACTIVITY SUPABASE] getActivitySubmissions:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const deleteSubmission = async (req: AuthRequest, res: Response) => {
  const { id, submissionId } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

  if (role !== "student") {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  try {
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    const supabase = getSupabaseClient();
    const { data: existing, error: existingError } = await supabase
      .from("activity_submissions")
      .select("id, student_id, file_path")
      .eq("id", Number(submissionId))
      .eq("activity_id", Number(id))
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Submission not found" });
    }

    if (existing.student_id !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    if (existing.file_path) {
      const filePath = path.join(
        process.cwd(),
        "uploads",
        "activities",
        existing.file_path,
      );
      try {
        await fs.unlink(filePath);
      } catch (e) {
        console.error("Failed to delete file:", e);
      }
    }

    const { error } = await supabase
      .from("activity_submissions")
      .delete()
      .eq("id", Number(submissionId));

    if (error) throw error;

    return res.json({ success: true, message: "Submission removed" });
  } catch (error) {
    console.error("[ACTIVITY SUPABASE] deleteSubmission:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const gradeSubmission = async (req: AuthRequest, res: Response) => {
  const { id, submissionId } = req.params;
  const { score } = req.body;
  const userId = req.user!.userId;
  const role = req.user!.role;

  if (role !== "teacher") {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  try {
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    const maxScore = auth.activity?.max_score || 100;
    const parsedScore = parseFloat(score);

    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > maxScore) {
      return res.status(400).json({
        success: false,
        error: `Score must be between 0 and ${maxScore}`,
      });
    }

    const supabase = getSupabaseClient();

    const { data: subRow, error: subCheckError } = await supabase
      .from("activity_submissions")
      .select("id, student_id, activity_id")
      .eq("id", Number(submissionId))
      .eq("activity_id", Number(id))
      .limit(1)
      .maybeSingle();

    if (subCheckError) throw subCheckError;
    if (!subRow) {
      return res
        .status(404)
        .json({ success: false, error: "Submission not found" });
    }

    const { error: updateError } = await supabase
      .from("activity_submissions")
      .update({
        score: parsedScore,
        graded_at: new Date().toISOString(),
        graded_by: userId,
      })
      .eq("id", Number(submissionId));

    if (updateError) throw updateError;

    const [
      { data: updated, error: updatedError },
      { data: user, error: userError },
    ] = await Promise.all([
      supabase
        .from("activity_submissions")
        .select(
          "id, activity_id, student_id, file_path, original_name, mime_type, score, graded_at, graded_by, created_at, updated_at",
        )
        .eq("id", Number(submissionId))
        .limit(1)
        .maybeSingle(),
      supabase
        .from("users")
        .select("username, email, section")
        .eq("id", subRow.student_id)
        .limit(1)
        .maybeSingle(),
    ]);

    if (updatedError) throw updatedError;
    if (userError) throw userError;

    void supabase.from("notifications").insert({
      recipient_id: subRow.student_id,
      sender_id: userId,
      type: "grade",
      message: `Your activity \"${auth.activity?.title || "Activity"}\" was graded ${parsedScore}/${maxScore}.`,
      link: `/activity/${id}/view`,
    });

    return res.json({
      success: true,
      message: "Score updated",
      submission: {
        ...updated,
        username: user?.username || "Unknown",
        email: user?.email || "",
        section: user?.section || null,
      },
      maxScore,
    });
  } catch (error) {
    console.error("[ACTIVITY SUPABASE] gradeSubmission:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export { upload };

const controller = {
  getActivityById,
  getActivityComments,
  getActivitySubmissions,
  getClassroomActivities,
  getMySubmission,
  deleteActivity,
  deleteComment,
  deleteReply,
  deleteSubmission,
  editComment,
  editInstruction,
  createActivity,
  createComment,
  createReply,
  gradeSubmission,
  submitActivity,
  updateInstructions,
};

export default controller;
