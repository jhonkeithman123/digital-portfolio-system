import type { Response } from "express";
import type { AuthRequest } from "middleware/auth";
import { getSupabaseClient } from "../supabase/client";

type NotificationRow = {
  id: number;
  recipient_id: number;
  sender_id: number | null;
  type: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  updated_at: string;
};

const fetchAllNotifications = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("notifications")
      .select(
        "id, recipient_id, sender_id, type, message, link, is_read, created_at, updated_at",
      )
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const notifications = ((data || []) as NotificationRow[]).map((n) => ({
      ...n,
      is_read: n.is_read ? 1 : 0,
    }));

    return res.json({ success: true, notifications });
  } catch (err) {
    const error = err as Error;
    console.error("[DEFAULT SUPABASE] fetchAllNotifications:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const markNotificationAsRead = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const rawNotificationId = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;
  const notificationId = Number.parseInt(rawNotificationId, 10);

  if (!Number.isFinite(notificationId) || notificationId <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid notification id" });
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("recipient_id", userId);

    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    const error = err as Error;
    console.error("[DEFAULT SUPABASE] markNotificationAsRead:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const markAllNotificationsAsRead = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", userId)
      .eq("is_read", false);

    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    const error = err as Error;
    console.error(
      "[DEFAULT SUPABASE] markAllNotificationsAsRead:",
      error.message,
    );
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const markMultipleNotificationsAsRead = async (
  req: AuthRequest,
  res: Response,
) => {
  const userId = req.user!.userId;
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids
        .map((v: unknown) => Number.parseInt(String(v), 10))
        .filter((v: number) => Number.isFinite(v) && v > 0)
    : [];

  if (!ids.length) {
    return res.json({ success: true, updated: 0 });
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", userId)
      .in("id", ids)
      .select("id");

    if (error) throw error;
    return res.json({ success: true, updated: data?.length || 0 });
  } catch (err) {
    const error = err as Error;
    console.error(
      "[DEFAULT SUPABASE] markMultipleNotificationsAsRead:",
      error.message,
    );
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const deleteAllNotifications = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("recipient_id", userId);

    if (error) throw error;
    return res.json({ success: true, message: "All notifications deleted" });
  } catch (err) {
    console.error("[DEFAULT SUPABASE] deleteAllNotifications:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteSelectedNotifications = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids
        .map((v: unknown) => Number.parseInt(String(v), 10))
        .filter((v: number) => Number.isFinite(v) && v > 0)
    : [];

  if (!ids.length) {
    return res
      .status(400)
      .json({ success: false, message: "No notification IDs provided" });
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("recipient_id", userId)
      .in("id", ids);

    if (error) throw error;

    return res.json({ success: true, message: "Notifications deleted" });
  } catch (err) {
    console.error("[DEFAULT SUPABASE] deleteSelectedNotifications:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const fetchSections = async (_req: AuthRequest, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .select("section")
      .eq("role", "student")
      .order("section", { ascending: true });

    if (error) throw error;

    const sections = [...new Set((data || []).map((r) => r.section))].filter(
      (s): s is string => typeof s === "string" && s.trim() !== "",
    );

    return res.json({ success: true, sections });
  } catch (err) {
    const error = err as Error;
    console.error("[DEFAULT SUPABASE] fetchSections:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const listStudents = async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== "teacher") {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  const { missing } = req.query;
  const shouldFilterMissing = missing === "1" || missing === "true";

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, username, email, section")
      .eq("role", "student")
      .order("username", { ascending: true });

    if (error) throw error;

    const students = (data || []).filter((s) =>
      shouldFilterMissing ? !s.section || !String(s.section).trim() : true,
    );

    return res.json({ success: true, students });
  } catch (err) {
    const error = err as Error;
    console.error("[DEFAULT SUPABASE] listStudents:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const editStudentSection = async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== "teacher") {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  const rawStudentId = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;
  const studentId = Number.parseInt(rawStudentId, 10);
  if (!Number.isFinite(studentId) || studentId <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid student id" });
  }

  const rawSection = req.body?.section;
  const normalizedSection =
    typeof rawSection === "string"
      ? rawSection.trim() || null
      : rawSection == null
        ? null
        : String(rawSection).trim() || null;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .update({ section: normalizedSection })
      .eq("id", studentId)
      .eq("role", "student")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    return res.json({ success: true, section: normalizedSection });
  } catch (err) {
    const error = err as Error;
    console.error("[DEFAULT SUPABASE] editStudentSection:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const controller = {
  editStudentSection,
  fetchAllNotifications,
  fetchSections,
  listStudents,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  markMultipleNotificationsAsRead,
  deleteAllNotifications,
  deleteSelectedNotifications,
};

export default controller;
