import crypto from "node:crypto";
import { RecipientDetails } from "../db/types.js";
import { logger } from "../utils/logger.js";

export interface PayoutResult {
  payoutReference: string;
  clearedAt: string;
  status: "SUCCESS" | "FAILED";
  failureReason?: string;
}

export class BankSimulator {
  /**
   * Simulates Indian banking rails (IMPS / NEFT / UPI rail) clearing payout in INR
   */
  public async executePayout(
    transferId: string,
    amountMinor: number,
    targetCurrency: string,
    recipient: RecipientDetails
  ): Promise<PayoutResult> {
    // Simulate payment network rail processing latency
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Deterministic simulation: if recipient account number ends in "0000", payout fails
    if (recipient.account_number?.endsWith("0000")) {
      logger.warn({ transferId, recipient }, "Simulated recipient bank rejected payout");
      return {
        payoutReference: `FAIL-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
        clearedAt: new Date().toISOString(),
        status: "FAILED",
        failureReason: "Beneficiary bank account invalid or frozen"
      };
    }

    const payoutRef = `${targetCurrency==="INR"?"IMPS":"DEMO-"+targetCurrency}-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    logger.info(
      {
        transferId,
        amountMinor,
        targetCurrency,
        recipientName: recipient.name,
        payoutRef
      },
      "Simulated local banking rail payout executed successfully"
    );

    return {
      payoutReference: payoutRef,
      clearedAt: new Date().toISOString(),
      status: "SUCCESS"
    };
  }
}

export const bankSimulator = new BankSimulator();
