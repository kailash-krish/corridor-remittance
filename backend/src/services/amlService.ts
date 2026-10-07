import crypto from "node:crypto";
import { db } from "../db/repository.js";
import { AmlFlag, Transfer } from "../db/types.js";
import { evaluateAmlRules, AmlAssessment } from "./amlRules.js";
import { transferOrchestrator } from "../orchestrator/transferOrchestrator.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export interface AmlCheckResult {
  action: "PASS" | "FLAG_FOR_REVIEW" | "REJECT";
  reason?: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assessment?: AmlAssessment;
}

export interface AmlQueueItem {
  flag: AmlFlag;
  transfer: Transfer | null;
}

export class AmlService {
  /**
   * Evaluates transfer against the pure AML rules engine
   */
  public async screenTransfer(transfer: Transfer): Promise<AmlCheckResult> {
    // 1. Gather historical context for user
    const userTransfers = await db.transfers.findByUserId(transfer.user_id);
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentTransfers24h = userTransfers.filter(
      (t) => new Date(t.created_at).getTime() >= oneDayAgo
    );

    // 2. Evaluate pure rules
    const assessment = evaluateAmlRules({
      transfer,
      recentTransfers24h,
      userTotalTransfersCount: userTransfers.length
    });

    logger.info(
      {
        transferId: transfer.id,
        riskScore: assessment.riskScore,
        riskLevel: assessment.riskLevel,
        triggeredRules: assessment.triggeredRules.map((r) => r.rule)
      },
      "AML compliance assessment completed"
    );

    if (assessment.recommendedAction === "PASS") {
      return {
        action: "PASS",
        assessment
      };
    }

    // Compose explanatory reason from triggered rules
    const combinedReason = assessment.triggeredRules.map((r) => r.reason).join(" | ");

    if (assessment.recommendedAction === "REVIEW") {
      await this.flagTransfer(transfer, combinedReason, "MEDIUM", assessment);
      return {
        action: "FLAG_FOR_REVIEW",
        reason: combinedReason,
        severity: "MEDIUM",
        assessment
      };
    }

    // HOLD / Critical Flag (score >= 70)
    await this.flagTransfer(transfer, combinedReason, "CRITICAL", assessment);
    return {
      action: "FLAG_FOR_REVIEW", // Sent to admin AML_REVIEW queue
      reason: combinedReason,
      severity: "CRITICAL",
      assessment
    };
  }

  /**
   * Persists an AML flag record in the database
   */
  public async flagTransfer(
    transfer: Transfer,
    reason: string,
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    assessment?: AmlAssessment
  ): Promise<AmlFlag> {
    const flag: AmlFlag = {
      id: crypto.randomUUID(),
      transfer_id: transfer.id,
      user_id: transfer.user_id,
      reason,
      severity,
      status: "PENDING",
      decision_notes: assessment ? `Score: ${assessment.riskScore}/100 (${assessment.riskLevel})` : null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await db.aml.insert(flag);
    return flag;
  }

  /**
   * Admin: List pending AML review queue
   */
  public async getPendingQueue(): Promise<AmlQueueItem[]> {
    const pendingFlags = await db.aml.findAllPending();
    const items: AmlQueueItem[] = [];

    for (const flag of pendingFlags) {
      const transfer = await db.transfers.findById(flag.transfer_id);
      items.push({ flag, transfer });
    }

    return items;
  }

  /**
   * Admin: Retrieve specific AML flag details with transfer
   */
  public async getFlagDetails(flagId: string): Promise<AmlQueueItem> {
    const flag = await db.aml.findById(flagId);
    if (!flag) {
      throw new NotFoundError(`AML Flag not found: ${flagId}`);
    }

    const transfer = await db.transfers.findById(flag.transfer_id);
    return { flag, transfer };
  }

  /**
   * Admin: Decision endpoint (approve | reject).
   * MUST go through the transfer orchestrator to trigger next steps!
   */
  public async processAdminDecision(
    flagId: string,
    adminUserId: string,
    decision: "approve" | "reject",
    note: string
  ): Promise<{ flag: AmlFlag; transfer: Transfer }> {
    const flag = await db.aml.findById(flagId);
    if (!flag) {
      throw new NotFoundError(`AML Flag not found: ${flagId}`);
    }

    if (flag.status !== "PENDING") {
      throw new BadRequestError(`AML Flag has already been resolved: ${flag.status}`);
    }

    const transfer = await db.transfers.findById(flag.transfer_id);
    if (!transfer) {
      throw new NotFoundError(`Associated transfer not found: ${flag.transfer_id}`);
    }

    // 1. Update flag
    const updatedFlag = await db.aml.update(flagId, {
      status: decision === "approve" ? "APPROVED" : "REJECTED",
      decision_notes: note,
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString()
    });

    // 2. Advance the transfer via orchestrator
    const targetStatus = decision === "approve" ? "CONVERTING" : "REJECTED";
    const eventName =
      decision === "approve"
        ? "AML_ADMIN_MANUAL_APPROVED"
        : "AML_ADMIN_MANUAL_REJECTED";

    const updatedTransfer = await transferOrchestrator.advance(transfer.id, {
      name: eventName,
      targetStatus,
      metadata: {
        flagId,
        decision,
        reviewedBy: adminUserId,
        note
      }
    });

    return {
      flag: updatedFlag || flag,
      transfer: updatedTransfer
    };
  }
}

export const amlService = new AmlService();
