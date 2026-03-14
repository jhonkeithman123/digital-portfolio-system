import express from "express";
import wrapAsync from "utils/wrapAsync";
import db from "config/db";
import mysqlController from "controllers/security";
import supabaseController from "controllers/securitySupabase";

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
