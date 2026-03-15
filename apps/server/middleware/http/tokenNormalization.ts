import type { NextFunction, Request, Response } from "express";

export function normalizeTokenSource(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || String(authHeader).trim() === "") {
      if (req.cookies?.token) {
        req.headers.authorization = `Bearer ${req.cookies.token}`;
      } else if (req.query?.token) {
        req.headers.authorization = `Bearer ${String(req.query.token)}`;
      }
    }
  } catch (_e) {
    // Ignore parsing errors to avoid blocking unrelated requests.
  }

  next();
}
