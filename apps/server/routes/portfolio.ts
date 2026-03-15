import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { verifyToken } from "../middleware/auth.js";
import db from "../config/db.js";
import mysqlController from "../controllers/portfolio.js";
import supabaseController from "../controllers/portfolioSupabase.js";

const router = express.Router();
const controller = db.isSupabaseOnlyMode()
  ? supabaseController
  : mysqlController;

// Get all activities for the current user (student or teacher)
router.get("/activities", verifyToken, wrapAsync(controller.getUserActivities));

// Get activity details by ID
router.get(
  "/activities/:id",
  verifyToken,
  wrapAsync(controller.getActivityDetails),
);

// Get submission details for an activity
router.get(
  "/activities/:id/submission",
  verifyToken,
  wrapAsync(controller.getActivitySubmission),
);

export default router;
