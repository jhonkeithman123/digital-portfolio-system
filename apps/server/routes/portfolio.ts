import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { verifyToken } from "../middleware/auth.js";
import db from "../config/db.js";
import mysqlController from "../controllers/portfolio.js";
import supabaseController from "../controllers/portfolioSupabase.js";
import docsController from "../controllers/portfolioDocs.js";
import driveController, { previewDriveFile } from "../controllers/drive.js";

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

// Serve docs-based portfolios (filesystem under /docs/portfolios)
router.get("/docs", verifyToken, wrapAsync(docsController.listPortfolios));
// Serve docs-based portfolios (filesystem under /docs/portfolios)
router.get("/docs", verifyToken, wrapAsync(docsController.listPortfolios));

// More specific docs routes first so they don't get captured by the
// `/docs/:folder` param route.
// Recursive folder listing: accept `path` as a query parameter (e.g. /docs/path?path=Work%20Immersion/sub)
router.get("/docs/path", verifyToken, wrapAsync(docsController.getPath));

// Get file by arbitrary path via query parameter: /docs/file?path=Work%20Immersion/front-page.md
router.get("/docs/file", verifyToken, wrapAsync(docsController.getFileByPath));

// Get a specific portfolio markdown file's content (single-level)
router.get(
  "/docs/:folder/:file",
  verifyToken,
  wrapAsync(docsController.getFile),
);

// List files in a portfolio folder (single-level)
router.get("/docs/:folder", verifyToken, wrapAsync(docsController.getFolder));

// Drive endpoints for user-uploaded files (apps/docs/drive_uploads)
router.get(
  "/drive/files",
  verifyToken,
  wrapAsync(driveController.listDriveFiles),
);
router.get(
  "/drive/download",
  verifyToken,
  wrapAsync(driveController.downloadDriveFile),
);
router.get("/drive/preview", verifyToken, wrapAsync(previewDriveFile));
router.post(
  "/drive/upload",
  verifyToken,
  driveController.upload.single("file"),
  wrapAsync(driveController.uploadToDrive),
);

export default router;
