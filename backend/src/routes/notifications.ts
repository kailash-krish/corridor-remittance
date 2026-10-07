import { Router, Request, Response, NextFunction } from "express";
import { notificationService } from "../services/notificationService.js";
import { requireAuth } from "../middleware/auth.js";
import { BadRequestError } from "../utils/errors.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

// GET /notifications: List user notifications
notificationsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new BadRequestError("Authenticated user required");
    }

    const notifications = await notificationService.getUserNotifications(req.user.id);
    res.status(200).json({
      data: notifications
    });
  } catch (err) {
    next(err);
  }
});

// POST /notifications/:id/read: Mark notification as read
notificationsRouter.post("/:id/read", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new BadRequestError("Authenticated user required");
    }

    const updated = await notificationService.markAsRead(req.params.id, req.user.id);
    res.status(200).json({
      data: updated
    });
  } catch (err) {
    next(err);
  }
});
