import bcrypt from "bcrypt";
import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { getSupabaseClient } from "../supabase/client.js";
import { generateToken } from "../config/helpers/generateToken.js";
import { setAuthCookie, clearAuthCookie } from "../utils/authCookies.js";
import { sendVerificationEmail } from "../config/sendVerificationEmail.js";
import { isAdminUser } from "../config/helpers/adminAccess.js";
import {
  generateVerificationCode,
  isVerificationCodeValid,
} from "../config/helpers/verification.js";

interface SupabaseUserRow {
  id: number;
  username: string;
  email: string;
  role: string;
  section: string | null;
  grade: string | null;
  student_number: string | null;
  password: string;
  verification_code: string | null;
  verification_expiry: string | null;
  is_verified: boolean;
}

const ALLOWED_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "protonmail.com",
  "aol.com",
  "zoho.com",
  "mail.com",
  "yandex.com",
  "msn.com",
  "gmx.com",
  "tutanota.com",
];

function validateEmailDomain(email: string): {
  valid: boolean;
  error?: string;
} {
  const trimmedEmail = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, error: "Invalid email format" };
  }

  const domain = trimmedEmail.split("@")[1];
  if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    return {
      valid: false,
      error: `Email domain '${domain}' is not supported. Please use Gmail, Yahoo, Outlook, Hotmail, or iCloud.`,
    };
  }

  return { valid: true };
}

const getUserById = async (id: number): Promise<SupabaseUserRow | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, username, email, role, section, grade, student_number, password, verification_code, verification_expiry, is_verified",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as SupabaseUserRow | null) ?? null;
};

const getUserByEmail = async (
  email: string,
): Promise<SupabaseUserRow | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, username, email, role, section, grade, student_number, password, verification_code, verification_expiry, is_verified",
    )
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  return (data as SupabaseUserRow | null) ?? null;
};

const getUserByUsername = async (
  username: string,
): Promise<SupabaseUserRow | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, username, email, role, section, grade, student_number, password, verification_code, verification_expiry, is_verified",
    )
    .eq("username", username)
    .maybeSingle();

  if (error) throw error;
  return (data as SupabaseUserRow | null) ?? null;
};

const checkSession = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  try {
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const isAdmin = isAdminUser({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    return res.json({
      success: true,
      user: {
        ID: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        section: user.section,
        grade: user.grade,
        student_number: user.student_number,
        isAdmin,
      },
    });
  } catch (err) {
    console.error("[AUTH SUPABASE] /session error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
};

const checkUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = await getUserById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.username,
        email: user.email,
        role: user.role,
        section: user.section,
      },
    });
  } catch (err) {
    console.error("[AUTH SUPABASE] /me error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const studentSetSection = async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== "student") {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  const section = (req.body?.section ?? "").toString().trim();
  if (!section) {
    return res
      .status(400)
      .json({ success: false, message: "Section is required" });
  }

  try {
    const user = await getUserById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    if (user.section && user.section.trim() !== "") {
      return res.json({ success: false, message: "Section already set" });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("users")
      .update({ section })
      .eq("id", req.user!.userId);

    if (error) throw error;

    return res.json({ success: true, section });
  } catch (err) {
    console.error("[AUTH SUPABASE] /me/section error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const ping = (req: AuthRequest, res: Response) => {
  return res.json({ success: true, userId: req.user!.userId });
};

const login = async (req: AuthRequest, res: Response) => {
  const { emailOrUsername, password, role: intendedRole } = req.body;

  if (!emailOrUsername || !password || !intendedRole) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const isEmail = emailOrUsername.includes("@");
    const normalizedInput = isEmail
      ? emailOrUsername.toLowerCase().trim()
      : emailOrUsername.trim();

    const user = isEmail
      ? await getUserByEmail(normalizedInput)
      : await getUserByUsername(normalizedInput);

    if (!user || user.role !== intendedRole) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const { token } = generateToken(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        username: user.username,
        section: user.section,
      },
      "24h",
    );

    setAuthCookie(res, token);

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.username,
        role: user.role,
        email: user.email,
        section: user.section || null,
      },
    });
  } catch (error) {
    console.error("[AUTH SUPABASE] login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const logout = (_req: AuthRequest, res: Response) => {
  clearAuthCookie(res);
  return res.json({ success: true });
};

const signup = async (req: AuthRequest, res: Response) => {
  const { username, email, password, role, section, grade, studentNumber } =
    req.body;

  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const emailValidation = validateEmailDomain(email);
  if (!emailValidation.valid) {
    return res.status(400).json({ error: emailValidation.error });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const existingUserByEmail = await getUserByEmail(normalizedEmail);
    if (existingUserByEmail) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const existingUserByUsername = await getUserByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .insert({
        username,
        email: normalizedEmail,
        password: hashedPassword,
        role,
        section: section || null,
        student_number: studentNumber || null,
        grade: grade || null,
        is_verified: false,
      })
      .select("id")
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      message: "User created. Please verify your email.",
      userId: data.id,
    });
  } catch (err) {
    console.error("[AUTH SUPABASE] signup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const requestVerification = async (req: AuthRequest, res: Response) => {
  const { email, role } = req.body;

  if (!email || !role) {
    return res.status(400).json({ error: "Email and role are required" });
  }

  const emailValidation = validateEmailDomain(email);
  if (!emailValidation.valid) {
    return res.status(400).json({ error: emailValidation.error });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const user = await getUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role !== role) {
      return res
        .status(400)
        .json({ error: "Role mismatch. Please check your account type." });
    }

    const verification = generateVerificationCode({
      verification_code: user.verification_code,
      verification_expiry: user.verification_expiry
        ? new Date(user.verification_expiry)
        : null,
    });

    if (!verification.shouldUpdate) {
      return res.json({
        success: true,
        message:
          "A verification code is already active. Please check your email.",
      });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("users")
      .update({
        verification_code: verification.code,
        verification_expiry: verification.expiry,
      })
      .eq("email", normalizedEmail);

    if (error) throw error;

    const emailSent = await sendVerificationEmail(
      normalizedEmail,
      verification.code,
      verification.expiry,
    );

    if (!emailSent) {
      return res
        .status(500)
        .json({ error: "Failed to send verification email" });
    }

    return res.json({
      success: true,
      message: "Verification code sent to your email",
    });
  } catch (err) {
    console.error("[AUTH SUPABASE] requestVerification error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const verifyCode = async (req: AuthRequest, res: Response) => {
  const { email, code } = req.body;
  const normalizedEmail = (email || "").toLowerCase();

  try {
    const user = await getUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (!isVerificationCodeValid(user as any, code)) {
      return res.status(400).json({ error: "Invalid or expired code." });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("users")
      .update({
        is_verified: true,
        verification_code: null,
        verification_expiry: null,
      })
      .eq("email", normalizedEmail);

    if (error) throw error;

    return res.json({ success: true, message: "Email is verified." });
  } catch (err) {
    console.error("[AUTH SUPABASE] verifyCode error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const resetPassword = async (req: AuthRequest, res: Response) => {
  const { email, newPassword } = req.body;
  const normalizedEmail = (email || "").toLowerCase();

  try {
    const user = await getUserByEmail(normalizedEmail);
    if (!user || !user.is_verified) {
      return res.status(404).json({ error: "User not found or not verified." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("users")
      .update({
        password: hashedPassword,
        is_verified: false,
      })
      .eq("email", normalizedEmail);

    if (error) throw error;

    return res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (err) {
    console.error("[AUTH SUPABASE] resetPassword error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
};

const changeUsername = async (req: AuthRequest, res: Response) => {
  const { newUsername } = req.body;
  const userId = req.user!.userId;

  try {
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("users")
      .update({ username: newUsername })
      .eq("id", userId);

    if (error) throw error;

    return res.json({
      success: true,
      message: "Username updated successfully",
    });
  } catch (err) {
    console.error("[AUTH SUPABASE] changeUsername error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

const controller = {
  changeUsername,
  checkSession,
  checkUserProfile,
  studentSetSection,
  ping,
  login,
  logout,
  signup,
  requestVerification,
  verifyCode,
  resetPassword,
};

export default controller;
