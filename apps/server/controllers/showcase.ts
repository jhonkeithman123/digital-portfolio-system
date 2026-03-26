import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";

const fetchShowcase = async (req: AuthRequest, res: Response) => {
  try {
    return res.json({ success: true, items: [] });
  } catch (error) {
    console.error("[SHOWCASE] Error:", error);
    return res.status(500).json({ success: false, items: [] });
  }
};

export default { fetchShowcase };
