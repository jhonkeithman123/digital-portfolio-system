import express from "express";
import { verifyToken } from "middleware/auth";
import controllers from "controllers/showcase";

const router = express.Router();

router.get("/", verifyToken, controllers.fetchShowcase);

export default router;
