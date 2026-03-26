import type { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import fsSync from "fs";
const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRIVE_DIR = path.resolve(__dirname, "../../../docs/drive_uploads");

// Ensure folder exists at runtime (best-effort)
async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    // ignore
  }
}

function getUserDir(req: Request): string {
  const user = (req as any).user as { userId?: number } | undefined;
  const uid = user?.userId ? String(user.userId) : "anonymous";
  return path.join(DRIVE_DIR, uid);
}

// Multer storage for drive uploads: place files under user-specific folder
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userDir = getUserDir(req);
    void ensureDir(userDir).then(() => cb(null, userDir));
  },
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const base = file.originalname.replace(/\s+/g, "_");
    cb(null, `${ts}__${base}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const listDriveFiles = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const userDir = getUserDir(req);
    await ensureDir(userDir);
    const entries = await fs.readdir(userDir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile())
      .map((f) => ({ name: f.name }));
    return res.json({ success: true, files });
  } catch (err) {
    console.error("[DRIVE] listDriveFiles error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to list drive files" });
  }
};

// Upload to drive - middleware expected thereafter
const uploadToDrive = (
  req: Request,
  res: Response,
): Promise<Response> | Response => {
  // multer will populate req.file
  return res.json({ success: true, file: (req as any).file });
};

const downloadDriveFile = async (
  req: Request,
  res: Response,
): Promise<Response | void> => {
  try {
    const q = (req.query as any).path;
    if (!q)
      return res.status(400).json({ success: false, message: "Missing path" });
    const rel = String(q);

    const userDir = getUserDir(req);
    const filePath = path.join(userDir, rel);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(userDir)) {
      return res.status(400).json({ success: false, message: "Invalid path" });
    }

    // Debug logging: record attempted download
    const uid = (req as any).user?.userId ?? "unknown";
    console.info(
      `[DRIVE] download attempt user=${uid} requested="${rel}" resolved="${resolved}"`,
    );

    // Verify file exists before sending
    try {
      const st = await fs.stat(resolved);
      if (!st.isFile()) {
        console.warn(`[DRIVE] not a file: ${resolved}`);
        return res
          .status(404)
          .json({ success: false, message: "File not found" });
      }
    } catch (e: any) {
      if (e?.code === "ENOENT") {
        // If missing, also list userDir contents for debugging
        try {
          const dirEntries = await fs.readdir(userDir).catch(() => []);
          console.warn(
            `[DRIVE] file missing for user=${uid}. userDir entries:`,
            dirEntries.slice(0, 50),
          );
        } catch {}
        return res
          .status(404)
          .json({ success: false, message: "File not found" });
      }
      throw e;
    }

    // Use express res.sendFile for streaming
    return res.sendFile(resolved);
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }
    console.error("[DRIVE] downloadDriveFile error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to download file" });
  }
};

export default { listDriveFiles, uploadToDrive, upload, downloadDriveFile };

// Preview endpoint: convert ODT to HTML (if soffice is available) and return HTML
const previewDriveFile = async (
  req: Request,
  res: Response,
): Promise<Response | void> => {
  try {
    const q = (req.query as any).path;
    if (!q)
      return res.status(400).json({ success: false, message: "Missing path" });
    const rel = String(q);

    const userDir = getUserDir(req);
    const filePath = path.join(userDir, rel);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(userDir)) {
      return res.status(400).json({ success: false, message: "Invalid path" });
    }

    // quick existence check
    try {
      const st = await fs.stat(resolved);
      if (!st.isFile())
        return res
          .status(404)
          .json({ success: false, message: "File not found" });
    } catch (e: any) {
      if (e?.code === "ENOENT")
        return res
          .status(404)
          .json({ success: false, message: "File not found" });
      throw e;
    }

    const ext = path.extname(resolved).toLowerCase();
    if (ext !== ".odt") {
      // For non-ODT, fall back to sending the file directly (client can handle blob types)
      return res.sendFile(resolved);
    }

    // Convert ODT -> HTML using soffice into a temp dir
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drive-odt-"));
    const soffice = "soffice"; // require LibreOffice installed
    try {
      await execFileAsync(
        soffice,
        ["--headless", "--convert-to", "html", "--outdir", tmpDir, resolved],
        {
          timeout: 30_000,
        },
      );
    } catch (err: any) {
      console.error("[DRIVE][PREVIEW] conversion failed", err);
      // cleanup
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {}
      return res
        .status(501)
        .json({
          success: false,
          message:
            "Server cannot preview ODT (soffice not available or conversion failed)",
        });
    }

    // Read converted file - same basename with .html
    const outName = path.basename(resolved, path.extname(resolved)) + ".html";
    const outPath = path.join(tmpDir, outName);
    if (!fsSync.existsSync(outPath)) {
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {}
      return res
        .status(500)
        .json({ success: false, message: "Conversion produced no output" });
    }

    const html = await fs.readFile(outPath, "utf8");
    // cleanup temp dir asynchronously
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});

    res.type("text/html");
    return res.send(html);
  } catch (err: any) {
    console.error("[DRIVE][PREVIEW] error", err);
    return res.status(500).json({ success: false, message: "Preview failed" });
  }
};

export { previewDriveFile };
