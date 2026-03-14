import type { NextFunction, Request, Response } from "express";

const DEFAULT_CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN || "http://localhost:5173";

function getAllowedOrigins(clientUrl: string): string[] {
  // Derive preview URL: replace dev port (5173) with preview port (4173)
  const previewUrl = clientUrl.replace(/:5173$/, ":4173");
  const origins = new Set([clientUrl, previewUrl]);
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
