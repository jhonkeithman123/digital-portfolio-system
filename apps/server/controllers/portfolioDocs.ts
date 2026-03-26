import type { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORTFOLIOS_DIR = path.resolve(__dirname, "../../../docs/portfolios");

const listPortfolios = async (
  _req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const entries = await fs.readdir(PORTFOLIOS_DIR, { withFileTypes: true });
    const folders = entries.filter((e) => e.isDirectory()).map((d) => d.name);

    const portfolios = await Promise.all(
      folders.map(async (folder) => {
        const folderPath = path.join(PORTFOLIOS_DIR, folder);
        const files = await fs.readdir(folderPath, { withFileTypes: true });
        const mdFiles = files
          .filter((f) => f.isFile() && f.name.toLowerCase().endsWith(".md"))
          .map((f) => f.name);

        return { name: folder, files: mdFiles };
      }),
    );

    return res.json({ success: true, portfolios });
  } catch (err) {
    console.error("[PORTFOLIO DOCS] listPortfolios error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to list portfolios" });
  }
};

const getFolder = async (req: Request, res: Response): Promise<Response> => {
  try {
    let { folder } = req.params as { folder?: string | string[] };
    if (Array.isArray(folder)) folder = folder.join("/");
    folder = folder || "";
    const folderPath = path.join(PORTFOLIOS_DIR, folder);

    // Prevent path traversal
    const resolved = path.resolve(folderPath);
    if (!resolved.startsWith(PORTFOLIOS_DIR)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid folder" });
    }

    const entries = await fs.readdir(resolved, { withFileTypes: true });

    const folders = entries.filter((e) => e.isDirectory()).map((d) => d.name);
    const files = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md"))
      .map((f) => f.name);

    return res.json({ success: true, folder: folder, folders, files });
  } catch (err) {
    console.error("[PORTFOLIO DOCS] getFolder error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to read folder" });
  }
};

// List arbitrary path (supports nested folders). Uses wildcard capture from route.
const getPath = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Support path via query `?path=...`, named param `req.params.path`,
    // or legacy unnamed wildcard `req.params[0]`.
    const q = (req.query as any).path;
    const maybeRaw = q ?? (req.params as any).path ?? (req.params as any)[0];
    const raw = maybeRaw as string | string[] | undefined;
    let rel: string;
    if (Array.isArray(raw)) rel = raw.join("/");
    else rel = raw ? decodeURIComponent(String(raw)) : "";
    const targetPath = path.join(PORTFOLIOS_DIR, rel);

    const resolved = path.resolve(targetPath);
    if (!resolved.startsWith(PORTFOLIOS_DIR)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid folder" });
    }

    const entries = await fs.readdir(resolved, { withFileTypes: true });
    const folders = entries.filter((e) => e.isDirectory()).map((d) => d.name);
    const files = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md"))
      .map((f) => f.name);

    return res.json({ success: true, path: rel, folders, files });
  } catch (err) {
    console.error("[PORTFOLIO DOCS] getPath error:", err);
    // If the folder doesn't exist, return 404 so clients can respond appropriately
    const anyErr = err as any;
    if (anyErr?.code === "ENOENT") {
      return res
        .status(404)
        .json({ success: false, message: "Path not found" });
    }
    return res
      .status(500)
      .json({ success: false, message: "Failed to read path" });
  }
};

// Read file by arbitrary path (wildcard)
const getFileByPath = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    // Support path via query `?path=...`, named param `req.params.path`,
    // or legacy unnamed wildcard `req.params[0]`.
    const q = (req.query as any).path;
    const maybeRaw = q ?? (req.params as any).path ?? (req.params as any)[0];
    const raw = maybeRaw as string | undefined;
    if (!raw) {
      return res
        .status(400)
        .json({ success: false, message: "Missing file path" });
    }
    const rel = decodeURIComponent(raw);
    const filePath = path.join(PORTFOLIOS_DIR, rel);

    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(PORTFOLIOS_DIR)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid file path" });
    }

    const content = await fs.readFile(resolved, "utf8");
    return res.json({
      success: true,
      filename: path.basename(resolved),
      content,
    });
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }
    console.error("[PORTFOLIO DOCS] getFileByPath error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to read file" });
  }
};

const getFile = async (req: Request, res: Response): Promise<Response> => {
  try {
    let { folder, file } = req.params as {
      folder?: string | string[];
      file?: string | string[];
    };
    if (Array.isArray(folder)) folder = folder.join("/");
    if (Array.isArray(file)) file = file.join("/");
    folder = folder || "";
    file = file || "";
    const filePath = path.join(PORTFOLIOS_DIR, folder, file);

    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(PORTFOLIOS_DIR)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid file path" });
    }

    const content = await fs.readFile(resolved, "utf8");
    return res.json({ success: true, filename: file, content });
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }
    console.error("[PORTFOLIO DOCS] getFile error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to read file" });
  }
};

export default { listPortfolios, getFolder, getPath, getFile, getFileByPath };
