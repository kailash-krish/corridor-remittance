import { EventEmitter } from "node:events";
import crypto from "node:crypto";
import { db } from "../db/repository.js";
import { Notification, NotificationStatus } from "../db/types.js";
import { NotFoundError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export interface CreateNotificationInput {
  userId: string;
  type: string; // e.g. "KYC_RESULT", "FUNDS_RECEIVED", "AML_HOLD", "TRANSFER_COMPLETED", "TRANSFER_FAILED"
  payload: Record<string, unknown>;
  transferId?: string;
  channel?: "EMAIL" | "SMS" | "IN_APP" | "PUSH";
}

/**
 * Event-Driven Notification Service.
 * Extends EventEmitter so external transports (SendGrid email, Twilio SMS, Firebase Push)
 * can subscribe cleanly via `notificationService.on("notification:created", handler)`.
 */
export class NotificationService extends EventEmitter {
  constructor() {
    super();

    // Default mock transport listener logging dispatched notifications
    this.on("notification:created", (notification: Notification) => {
      logger.info(
        {
          notificationId: notification.id,
          userId: notification.user_id,
          type: notification.type,
          channel: notification.channel
        },
        "📢 Notification dispatched to channel transport"
      );
    });
  }

  /**
   * Creates, stores in DB outbox, and emits event for downstream transports
   */
  public async createNotification(input: CreateNotificationInput): Promise<Notification> {
    const notification: Notification = {
      id: crypto.randomUUID(),
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

    await db.notifications.insert(notification);

    // Emit event for real-time transports (WebSocket, Push, Email)
    this.emit("notification:created", notification);

    return notification;
  }

  /**
   * Retrieves all notifications for a specific user
   */
  public async getUserNotifications(userId: string): Promise<Notification[]> {
    return db.notifications.findByUserId(userId);
  }

  /**
   * Marks a notification as read
   */
  public async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const userNotifications = await db.notifications.findByUserId(userId);
    const notification = userNotifications.find((n) => n.id === notificationId);

    if (!notification) {
      throw new NotFoundError(`Notification not found: ${notificationId}`);
    }

    const updated = await db.notifications.markRead(notificationId);
    return updated || notification;
  }
}

export const notificationService = new NotificationService();
