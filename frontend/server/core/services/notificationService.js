"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
const node_events_1 = require("node:events");
const node_crypto_1 = __importDefault(require("node:crypto"));
const repository_js_1 = require("../db/repository.js");
const errors_js_1 = require("../utils/errors.js");
const logger_js_1 = require("../utils/logger.js");
/**
 * Event-Driven Notification Service.
 * Extends EventEmitter so external transports (SendGrid email, Twilio SMS, Firebase Push)
 * can subscribe cleanly via `notificationService.on("notification:created", handler)`.
 */
class NotificationService extends node_events_1.EventEmitter {
    constructor() {
        super();
        // Default mock transport listener logging dispatched notifications
        this.on("notification:created", (notification) => {
            logger_js_1.logger.info({
                notificationId: notification.id,
                userId: notification.user_id,
                type: notification.type,
                channel: notification.channel
            }, "📢 Notification dispatched to channel transport");
        });
    }
    /**
     * Creates, stores in DB outbox, and emits event for downstream transports
     */
    async createNotification(input) {
        const notification = {
            id: node_crypto_1.default.randomUUID(),
            user_id: input.userId,
            transfer_id: input.transferId || null,
            channel: input.channel || "EMAIL",
            type: input.type,
            payload: input.payload,
            status: "SENT",
            sent_at: new Date().toISOString(),
            error_message: null,
            created_at: new Date().toISOString()
        };
        await repository_js_1.db.notifications.insert(notification);
        // Emit event for real-time transports (WebSocket, Push, Email)
        this.emit("notification:created", notification);
        return notification;
    }
    /**
     * Retrieves all notifications for a specific user
     */
    async getUserNotifications(userId) {
        return repository_js_1.db.notifications.findByUserId(userId);
    }
    /**
     * Marks a notification as read
     */
    async markAsRead(notificationId, userId) {
        const userNotifications = await repository_js_1.db.notifications.findByUserId(userId);
        const notification = userNotifications.find((n) => n.id === notificationId);
        if (!notification) {
            throw new errors_js_1.NotFoundError(`Notification not found: ${notificationId}`);
        }
        const updated = await repository_js_1.db.notifications.markRead(notificationId);
        return updated || notification;
    }
}
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
