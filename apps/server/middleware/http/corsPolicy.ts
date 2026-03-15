import type { NextFunction, Request, Response } from "express";

const DEFAULT_CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN || "http://localhost:5173";

const DEFAULT_DEPLOYED_ORIGINS = [
  "https://digital-portfolio-system-web.vercel.app",
  "https://digital-portfolio-system-server.vercel.app",
];

function normalizeOrigin(origin: string): string {
  const trimmed = origin.trim();

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, "");
  }

  return `https://${trimmed}`.replace(/\/+$/, "");
}

function expandLocalhostAliases(originUrl: string): string[] {
  try {
    const parsed = new URL(originUrl);
    const host = parsed.hostname;
    const port = parsed.port ? `:${parsed.port}` : "";
    const protocol = parsed.protocol;

    const aliases = new Set<string>([originUrl]);

    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      aliases.add(`${protocol}//localhost${port}`);
      aliases.add(`${protocol}//127.0.0.1${port}`);
      aliases.add(`${protocol}//[::1]${port}`);
    }

    return Array.from(aliases);
  } catch {
    return [originUrl];
  }
}

function getAllowedOrigins(clientUrl: string): string[] {
  // Derive preview URL: replace dev port (5173) with preview port (4173)
  const previewUrl = clientUrl.replace(/:5173$/, ":4173");
  const configuredOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

  const origins = new Set<string>([
    ...expandLocalhostAliases(clientUrl),
    ...expandLocalhostAliases(previewUrl),
    ...DEFAULT_DEPLOYED_ORIGINS,
    ...configuredOrigins,
  ]);

  return Array.from(origins);
}

export function createCorsPolicy(clientUrl: string) {
  const allowedOrigins = getAllowedOrigins(clientUrl);

  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const origin = req.headers.origin;

    console.log(
      `[CORS] ${req.method} ${req.originalUrl} from origin: ${origin || "none"}`,
    );

    if (origin && allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      console.log(`[CORS] Allowing origin: ${origin}`);
    } else if (!origin) {
      res.header("Access-Control-Allow-Origin", clientUrl);
      console.log(`[CORS] Allowing no-origin request, using: ${clientUrl}`);
    } else {
      console.log(`[CORS] Rejecting origin: ${origin}`);
    }

    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    next();
  };
}

export { DEFAULT_CLIENT_ORIGIN };
