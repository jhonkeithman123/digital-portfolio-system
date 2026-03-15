import express, { type Request, type Response } from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { pingSupabaseConnection } from "../supabase/ping.js";

const router = express.Router();

router.get(
  "/health",
  wrapAsync(async (_req: Request, res: Response) => {
    const result = await pingSupabaseConnection();
    const statusCode = result.ok ? 200 : 503;
    res.status(statusCode).json(result);
  }),
);

export default router;
