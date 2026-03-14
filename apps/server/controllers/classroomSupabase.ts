import { Response } from "express";
import { AuthRequest } from "middleware/auth";
import generateCode from "config/code_generator";
import { getSupabaseClient } from "../supabase/client";

type StudentRow = {
  id: number;
  username: string;
  email: string;
  role: string;
  section: string | null;
  grade: string | null;
};

type ClassroomRow = {
  id: number;
  name: string;
  code: string;
  teacher_id: number;
  section: string | null;
  grade: string | null;
};

type ClassroomMemberRow = {
  id: number;
  classroom_id: number;
  student_id: number;
  status: "pending" | "accepted" | "rejected";
  code: string;
  name: string;
};

type HiddenInviteRow = {
  invite_id: number;
};

type InviteResponseRow = {
  id: number;
  classroomName: string;
  code: string;
  teacherName: string;
  hidden: 0 | 1;
};

const checkIfStudentIsEnrolled = async (req: AuthRequest, res: Response) => {
  const studentId = req.user!.userId;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("classroom_members")
      .select("classroom_id, status, code, name")
      .eq("student_id", studentId)
      .eq("status", "accepted")
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const classroom = data || null;
    const isEnrolled = Boolean(classroom);

    return res.json({
      success: true,
      enrolled: isEnrolled,
      classroomId: classroom?.classroom_id || null,
      code: classroom?.code || null,
      name: classroom?.name || null,
    });
  } catch (error) {
    console.error("[CLASSROOM SUPABASE] checkIfStudentIsEnrolled:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const checkIfTeacherHasClassroom = async (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.userId;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("classrooms")
      .select("id, code, name, section")
      .eq("teacher_id", teacherId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return res.json({
      success: true,
      created: Boolean(data),
      classroomId: data?.id || null,
      code: data?.code || null,
      name: data?.name || null,
      section: data?.section ?? null,
    });
  } catch (error) {
    console.error("[CLASSROOM SUPABASE] checkIfTeacherHasClassroom:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const createClassroom = async (req: AuthRequest, res: Response) => {
  const { name, schoolYear, section, grade } = req.body;
  const teacherId = req.user!.userId;
  const code = generateCode();

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("classrooms")
      .insert({
        name,
        school_year: schoolYear,
        section: section || null,
        grade: grade || null,
        teacher_id: teacherId,
        code,
      })
      .select("id")
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      classroomId: data.id,
      code,
    });
  } catch (error) {
    console.error("[CLASSROOM SUPABASE] createClassroom:", error);
    return res.status(500).json({ success: false, error: "Database error" });
  }
};

const modifySectionTeacher = async (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.userId;
  let { section, code } = req.body;

  if (!code) {
    return res
      .status(400)
      .json({ success: false, error: "Missing classroom code" });
  }

  try {
    if (typeof section === "string") {
      section = section.trim();
      if (section === "") section = null;
    }

    if (section !== null && typeof section !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Invalid section type" });
    }

    const supabase = getSupabaseClient();
    const { data: classroom, error: checkError } = await supabase
      .from("classrooms")
      .select("id")
      .eq("code", code)
      .eq("teacher_id", teacherId)
      .limit(1)
      .maybeSingle();

    if (checkError) throw checkError;
    if (!classroom) {
      return res
        .status(403)
        .json({ success: false, error: "Not authorized for this classroom" });
    }

    const { error } = await supabase
      .from("classrooms")
      .update({ section })
      .eq("code", code)
      .eq("teacher_id", teacherId);

    if (error) throw error;

    return res.json({
      success: true,
      message: section
        ? "Classroom section updated"
        : "Classroom section cleared",
      section,
    });
  } catch (error) {
    console.error("[CLASSROOM SUPABASE] modifySectionTeacher:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
};

const fetchUnenrolledStudents = async (req: AuthRequest, res: Response) => {
  const { code } = req.params;
  const { section } = req.query;

  try {
    const supabase = getSupabaseClient();
    const { data: classroom, error: classroomError } = await supabase
      .from("classrooms")
      .select("id, grade, section")
      .eq("code", code)
      .limit(1)
      .maybeSingle();

    if (classroomError) throw classroomError;
    if (!classroom) {
      return res
        .status(404)
        .json({ success: false, message: "Classroom not found" });
    }

    const { data: members, error: membersError } = await supabase
      .from("classroom_members")
      .select("student_id, status")
      .eq("classroom_id", classroom.id)
      .in("status", ["accepted", "pending"]);

    if (membersError) throw membersError;

    const excludedStudentIds = new Set(
      (members || []).map((m) => m.student_id),
    );

    let usersQuery = supabase
      .from("users")
      .select("id, username, email, role, section, grade")
      .eq("role", "student");

    if (classroom.grade) {
      usersQuery = usersQuery.eq("grade", classroom.grade);
    }

    const { data: users, error: usersError } = await usersQuery;
    if (usersError) throw usersError;

    const sectionFilter =
      typeof section === "string" && section !== "all" && section.trim() !== ""
        ? section.trim()
        : null;
    const strandFilter = sectionFilter?.split("-")[0]?.toLowerCase() || null;

    const filtered = (users as StudentRow[])
      .filter((u) => !excludedStudentIds.has(u.id))
      .filter((u) => {
        if (!strandFilter) return true;
        return (u.section || "").toLowerCase().startsWith(strandFilter);
      })
      .sort((a, b) => {
        const secA = (a.section || "").toLowerCase();
        const secB = (b.section || "").toLowerCase();
        if (secA !== secB) return secA.localeCompare(secB);
        return a.username.localeCompare(b.username);
      })
      .map((u) => ({
        id: u.id,
        name: u.username,
        email: u.email,
        role: u.role,
        section: u.section,
        grade: u.grade,
      }));

    return res.status(200).json({ success: true, students: filtered });
  } catch (error) {
    console.error("[CLASSROOM SUPABASE] fetchUnenrolledStudents:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const sendClassroomInviteForStudent = async (
  req: AuthRequest,
  res: Response,
) => {
  const { studentId } = req.body;
  const { code } = req.params;

  try {
    const supabase = getSupabaseClient();

    const { data: classroom, error: classroomError } = await supabase
      .from("classrooms")
      .select("id, name")
      .eq("code", code)
      .limit(1)
      .maybeSingle();

    if (classroomError) throw classroomError;
    if (!classroom) {
      return res
        .status(404)
        .json({ success: false, message: "Classroom not found." });
    }

    const { data: existing, error: existingError } = await supabase
      .from("classroom_members")
      .select("id")
      .eq("classroom_id", classroom.id)
      .eq("student_id", Number(studentId))
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Student already invited." });
    }

    const { error: insertError } = await supabase
      .from("classroom_members")
      .insert({
        classroom_id: classroom.id,
        name: classroom.name,
        student_id: Number(studentId),
        status: "pending",
        code,
      });

    if (insertError) throw insertError;

    const message = `You've been invited to join classroom ${code}`;
    const link = `/classrooms/${code}`;
    void supabase.from("notifications").insert({
      recipient_id: Number(studentId),
      sender_id: req.user!.userId,
      type: "invite",
      message,
      link,
    });

    return res
      .status(200)
      .json({ success: true, message: "Successfully invited student" });
  } catch (error) {
    console.error("[CLASSROOM SUPABASE] sendClassroomInviteForStudent:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const fetchClassroomInvites = async (req: AuthRequest, res: Response) => {
  const studentId = req.user!.userId;

  try {
    const supabase = getSupabaseClient();

    const { data: invitesRaw, error: invitesError } = await supabase
      .from("classroom_members")
      .select("id, classroom_id, student_id, status, code, name")
      .eq("student_id", studentId)
      .eq("status", "pending")
      .order("id", { ascending: false });

    if (invitesError) throw invitesError;

    const invites = (invitesRaw || []) as ClassroomMemberRow[];
    if (!invites.length) {
      return res.status(200).json({ success: true, invites: [] });
    }

    const classroomIds = [...new Set(invites.map((i) => i.classroom_id))];
    const inviteIds = invites.map((i) => i.id);

    const { data: classroomsRaw, error: classroomsError } = await supabase
      .from("classrooms")
      .select("id, name, code, teacher_id")
      .in("id", classroomIds);

    if (classroomsError) throw classroomsError;

    const classrooms = (classroomsRaw || []) as Pick<
      ClassroomRow,
      "id" | "name" | "code" | "teacher_id"
    >[];
    const teacherIds = [...new Set(classrooms.map((c) => c.teacher_id))];

    const [
      { data: teachersRaw, error: teachersError },
      { data: hiddenRaw, error: hiddenError },
    ] = await Promise.all([
      supabase.from("users").select("id, username").in("id", teacherIds),
      supabase
        .from("hidden_invites")
        .select("invite_id")
        .eq("student_id", studentId)
        .in("invite_id", inviteIds),
    ]);

    if (teachersError) throw teachersError;
    if (hiddenError) throw hiddenError;

    const classroomById = new Map<number, (typeof classrooms)[number]>();
    classrooms.forEach((c) => classroomById.set(c.id, c));

    const teacherById = new Map<number, string>();
    (teachersRaw || []).forEach((t) => teacherById.set(t.id, t.username));

    const hiddenSet = new Set<number>(
      ((hiddenRaw || []) as HiddenInviteRow[]).map((h) => h.invite_id),
    );

    const result: InviteResponseRow[] = invites.map((invite) => {
      const classroom = classroomById.get(invite.classroom_id);
      const teacherName = classroom
        ? (teacherById.get(classroom.teacher_id) ?? "Unknown")
        : "Unknown";

      return {
        id: invite.id,
        classroomName: classroom?.name || invite.name,
        code: classroom?.code || invite.code,
        teacherName,
        hidden: hiddenSet.has(invite.id) ? 1 : 0,
      };
    });

    return res.status(200).json({ success: true, invites: result });
  } catch (error) {
    console.error("[CLASSROOM SUPABASE] fetchClassroomInvites:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const dismissInvite = async (req: AuthRequest, res: Response) => {
  const { inviteId } = req.params;
  const studentId = req.user!.userId;

  try {
    const supabase = getSupabaseClient();
    const numericInviteId = Number(inviteId);

    const { data: invite, error: inviteError } = await supabase
      .from("classroom_members")
      .select("id")
      .eq("id", numericInviteId)
      .eq("student_id", studentId)
      .limit(1)
      .maybeSingle();

    if (inviteError) throw inviteError;
    if (!invite) {
      return res.status(404).json({
        success: false,
        error: "Invite not found or not authorized",
      });
    }

    const { error } = await supabase
      .from("hidden_invites")
      .upsert(
        { student_id: studentId, invite_id: numericInviteId },
        { onConflict: "student_id,invite_id" },
      );

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[CLASSROOM SUPABASE] dismissInvite:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const undismissInvite = async (req: AuthRequest, res: Response) => {
  const { inviteId } = req.params;
  const studentId = req.user!.userId;

  try {
    const supabase = getSupabaseClient();
    const numericInviteId = Number(inviteId);

    const { data: invite, error: inviteError } = await supabase
      .from("classroom_members")
      .select("id")
      .eq("id", numericInviteId)
      .eq("student_id", studentId)
      .limit(1)
      .maybeSingle();

    if (inviteError) throw inviteError;
    if (!invite) {
      return res.status(404).json({
        success: false,
        error: "Invite not found or not authorized",
      });
    }

    const { error } = await supabase
      .from("hidden_invites")
      .delete()
      .eq("student_id", studentId)
      .eq("invite_id", numericInviteId);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[CLASSROOM SUPABASE] undismissInvite:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const acceptInvite = async (req: AuthRequest, res: Response) => {
  const studentId = req.user!.userId;
  const numericInviteId = Number(req.params.inviteId);

  try {
    const supabase = getSupabaseClient();

    const { data: updatedRows, error: updateError } = await supabase
      .from("classroom_members")
      .update({ status: "accepted" })
      .eq("id", numericInviteId)
      .eq("student_id", studentId)
      .select("id");

    if (updateError) throw updateError;
    if (!updatedRows || updatedRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Invite not found or not authorized.",
      });
    }

    const { error: deleteHiddenError } = await supabase
      .from("hidden_invites")
      .delete()
      .eq("invite_id", numericInviteId)
      .eq("student_id", studentId);

    if (deleteHiddenError) {
      console.warn(
        "[CLASSROOM SUPABASE] acceptInvite hidden cleanup:",
        deleteHiddenError.message,
      );
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[CLASSROOM SUPABASE] acceptInvite:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const enterByClassroomByCode = async (req: AuthRequest, res: Response) => {
  const studentId = req.user!.userId;
  const { code } = req.body;

  try {
    const supabase = getSupabaseClient();

    const [
      { data: classroom, error: classroomError },
      { data: user, error: userError },
    ] = await Promise.all([
      supabase
        .from("classrooms")
        .select("id, name, code")
        .eq("code", code)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("users")
        .select("username")
        .eq("id", studentId)
        .limit(1)
        .maybeSingle(),
    ]);

    if (classroomError) throw classroomError;
    if (userError) throw userError;

    if (!classroom) {
      return res
        .status(404)
        .json({ success: false, error: "Invalid classroom code" });
    }

    const studentName = user?.username || "";

    const { data: member, error: memberError } = await supabase
      .from("classroom_members")
      .select("id, status")
      .eq("classroom_id", classroom.id)
      .eq("student_id", studentId)
      .limit(1)
      .maybeSingle();

    if (memberError) throw memberError;

    if (member && member.status === "accepted") {
      return res.status(400).json({
        success: false,
        error: "Already a member of this classroom",
      });
    }

    if (member) {
      const { error: updateError } = await supabase
        .from("classroom_members")
        .update({ status: "accepted" })
        .eq("id", member.id)
        .eq("student_id", studentId);

      if (updateError) throw updateError;

      const { error: cleanupError } = await supabase
        .from("hidden_invites")
        .delete()
        .eq("invite_id", member.id)
        .eq("student_id", studentId);

      if (cleanupError) {
        console.warn(
          "[CLASSROOM SUPABASE] enterByClassroomByCode cleanup:",
          cleanupError.message,
        );
      }
    } else {
      const { data: insertedRows, error: insertError } = await supabase
        .from("classroom_members")
        .insert({
          classroom_id: classroom.id,
          name: studentName,
          student_id: studentId,
          status: "accepted",
          code,
        })
        .select("id");

      if (insertError) {
        // Handle duplicate race if unique index exists.
        if ((insertError as { code?: string }).code === "23505") {
          const { data: existing, error: existingError } = await supabase
            .from("classroom_members")
            .select("id")
            .eq("classroom_id", classroom.id)
            .eq("student_id", studentId)
            .limit(1)
            .maybeSingle();

          if (existingError) throw existingError;

          if (existing) {
            const { error: promoteError } = await supabase
              .from("classroom_members")
              .update({ status: "accepted" })
              .eq("id", existing.id)
              .eq("student_id", studentId);

            if (promoteError) throw promoteError;
          }
        } else {
          throw insertError;
        }
      } else if (insertedRows && insertedRows[0]) {
        const { error: cleanupError } = await supabase
          .from("hidden_invites")
          .delete()
          .eq("invite_id", insertedRows[0].id)
          .eq("student_id", studentId);

        if (cleanupError) {
          console.warn(
            "[CLASSROOM SUPABASE] enterByClassroomByCode post-insert cleanup:",
            cleanupError.message,
          );
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Successfully joined classroom",
      classroom: {
        id: classroom.id,
        name: classroom.name,
        code: classroom.code,
      },
    });
  } catch (error) {
    console.error("[CLASSROOM SUPABASE] enterByClassroomByCode:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to join classroom" });
  }
};

const checkIfStudentIsClassroomMember = async (
  req: AuthRequest,
  res: Response,
) => {
  const { code } = req.params;
  const userId = req.user!.userId;

  try {
    const supabase = getSupabaseClient();
    const { data: classroom, error: classroomError } = await supabase
      .from("classrooms")
      .select("id, name, code, teacher_id")
      .eq("code", code)
      .limit(1)
      .maybeSingle();

    if (classroomError) throw classroomError;

    if (!classroom) {
      return res
        .status(404)
        .json({ success: false, message: "Classroom not found" });
    }

    const isTeacher = classroom.teacher_id === userId;

    const { data: membership, error: memberError } = await supabase
      .from("classroom_members")
      .select("status")
      .eq("classroom_id", classroom.id)
      .eq("student_id", userId)
      .limit(1)
      .maybeSingle();

    if (memberError) throw memberError;

    const status = membership?.status || null;
    const isMember = isTeacher || status === "accepted";

    return res.json({
      success: true,
      isMember,
      membershipStatus: status,
      isTeacher,
      classroom: {
        id: classroom.id,
        name: classroom.name,
        code: classroom.code,
      },
    });
  } catch (error) {
    console.error(
      "[CLASSROOM SUPABASE] checkIfStudentIsClassroomMember:",
      error,
    );
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const controller = {
  checkIfStudentIsEnrolled,
  checkIfTeacherHasClassroom,
  createClassroom,
  modifySectionTeacher,
  fetchUnenrolledStudents,
  sendClassroomInviteForStudent,
  fetchClassroomInvites,
  dismissInvite,
  undismissInvite,
  acceptInvite,
  enterByClassroomByCode,
  checkIfStudentIsClassroomMember,
};

export default controller;
