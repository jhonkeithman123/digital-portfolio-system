import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import db from "../config/db.js";
import mysqlController from "../controllers/security.js";
import supabaseController from "../controllers/securitySupabase.js";

const router = express.Router();
const controller = db.isSupabaseOnlyMode()
  ? supabaseController
  : mysqlController;

router.post(
  "/csp-report",
  express.json({ type: "application/csp-report" }),
  controller.cspReport,
);

router.post("/tamper-log", express.json(), wrapAsync(controller.tamperLog));

export default router;
