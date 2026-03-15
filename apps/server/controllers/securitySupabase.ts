import { Response } from "express";
import { AuthRequest } from "middleware/auth";
import { getSupabaseClient } from "../supabase/client";

const cspReport = (req: AuthRequest, res: Response) => {
  console.error("CSP Violation", req.body);
  res.status(204).end();
};

const tamperLog = async (req: AuthRequest, res: Response) => {
  const { type, detectedAt, role, userId } = req.body;
  const logMessage = `Tampering detected at ${new Date(
    detectedAt,
  ).toLocaleString()} - type: ${type}, role: ${role}, User ID: ${
    userId ?? "unknown"
  }`;

  try {
    const supabase = getSupabaseClient();

    // Best-effort logging: if table does not exist yet, we still return success
    // to avoid blocking client UX in Supabase-only mode.
    const { error } = await supabase.from("logging").insert({
      type,
      detected_at: detectedAt,
      role,
      user_id: userId || null,
      log: logMessage,
    });

    if (error) {
      console.warn(
        "[SECURITY SUPABASE] logging insert warning:",
        error.message,
      );
    }

    res.status(201).json({ success: "Successfully logged the tampering" });
  } catch (err) {
    console.error("[SECURITY SUPABASE] Failed to log tampering:", err);
    // Non-fatal: keep endpoint resilient in Supabase-only migration stage
    return res.status(201).json({
      success: "Tampering received (logging backend unavailable)",
    });
  }
};

const controllers = {
  cspReport,
  tamperLog,
};

export default controllers;
