import type { NextFunction, Request, Response } from "express";

export function requestLogger(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const start = Date.now();
  const origin = req.headers.origin || "<none>";

  console.info(
    `[REQ START] ${new Date().toISOString()} ${req.ip} ${req.method} ${req.originalUrl} origin=${origin}`,
  );

  _res.on("finish", () => {
    const duration = Date.now() - start;
    console.info(
      `[REQ END]   ${new Date().toISOString()} ${req.ip} ${req.method} ${req.originalUrl} status=${_res.statusCode} dur=${duration}ms`,
    );
  });

  next();
}

export function requestDebugLogger(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  console.log("[DEBUG] Cookies received:", req.cookies);
  console.log("[DEBUG] Auth header:", req.headers.authorization);
  next();
}
