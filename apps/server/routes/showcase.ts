import express from "express";
import { verifyToken } from "../middleware/auth.js";
import controllers from "../controllers/showcase.js";

const router = express.Router();

router.get("/", verifyToken, controllers.fetchShowcase);

export default router;
