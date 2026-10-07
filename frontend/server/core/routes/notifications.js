"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRouter = void 0;
const express_1 = require("express");
const notificationService_js_1 = require("../services/notificationService.js");
const auth_js_1 = require("../middleware/auth.js");
const errors_js_1 = require("../utils/errors.js");
exports.notificationsRouter = (0, express_1.Router)();
exports.notificationsRouter.use(auth_js_1.requireAuth);
// GET /notifications: List user notifications
exports.notificationsRouter.get("/", async (req, res, next) => {
    try {
        if (!req.user) {
            throw new errors_js_1.BadRequestError("Authenticated user required");
        }
        const notifications = await notificationService_js_1.notificationService.getUserNotifications(req.user.id);
        res.status(200).json({
            data: notifications
        });
    }
    catch (err) {
        next(err);
    }
});
// POST /notifications/:id/read: Mark notification as read
exports.notificationsRouter.post("/:id/read", async (req, res, next) => {
    try {
        if (!req.user) {
            throw new errors_js_1.BadRequestError("Authenticated user required");
        }
        const updated = await notificationService_js_1.notificationService.markAsRead(req.params.id, req.user.id);
        res.status(200).json({
            data: updated
        });
    }
    catch (err) {
        next(err);
    }
});
