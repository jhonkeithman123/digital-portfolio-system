import db from "../config/db.js";

export interface DbRequest {
  dbAvailable: boolean;
}

export const checkDbAvailability = async (
  req: any,
  res: any,
  next: () => void,
): Promise<void> => {
  try {
    await db.query("SELECT 1");
    (req as DbRequest).dbAvailable = true;
  } catch (err) {
    console.error("Database connection failed:", err);
    (req as DbRequest).dbAvailable = false;
  }

  next();
};

export const requireDb = (req: any, res: any, next: () => void): void => {
  if (!(req as DbRequest).dbAvailable) {
    res.status(503).json({
      success: false,
      error: "Database not available",
    });
    return;
  }

  next();
};
