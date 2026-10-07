import { describe, it, expect } from "vitest";
import {
  ruleAmountOverThreshold,
  ruleVelocity,
  ruleStructuring,
  ruleHighRiskCountry,
  ruleNewAccountLargeAmount,
  evaluateAmlRules
} from "../src/services/amlRules.js";
import { Transfer } from "../src/db/types.js";

describe("AML Pure Rules Engine", () => {
  const baseTransfer: Transfer = {
    id: "tx-1",
    user_id: "user-1",
    quote_id: "quote-1",
    status: "CREATED",
    source_currency: "AED",
    target_currency: "INR",
    send_amount_minor: 100000, // 1,000 AED
    receive_amount_minor: 2270000,
    fee_minor: 1000,
    exchange_rate: 22.7,
    sender_account_id: null,
    recipient_details: { name: "Rajesh Kumar", country: "IND" },
    blockchain_tx_hash: null,
    payout_reference: null,
    cancellation_reason: null,
    failure_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  it("Rule 1 (Amount Over Threshold): flags when >= 50,000 AED (5,000,000 fils)", () => {
    const normal = ruleAmountOverThreshold(baseTransfer);
    expect(normal.score).toBe(0);

    const highValue = ruleAmountOverThreshold({
      ...baseTransfer,
      send_amount_minor: 5_000_000 // 50,000 AED
    });
    expect(highValue.score).toBe(40);
    expect(highValue.rule).toBe("AMOUNT_OVER_THRESHOLD");
  });

  it("Rule 2 (Velocity): flags when user initiated >= 3 transfers in 24 hours", () => {
    const normal = ruleVelocity(baseTransfer, [baseTransfer]);
    expect(normal.score).toBe(0);

    const highVelocity = ruleVelocity(baseTransfer, [baseTransfer, baseTransfer, baseTransfer]);
    expect(highVelocity.score).toBe(35);
    expect(highVelocity.rule).toBe("VELOCITY_THRESHOLD_EXCEEDED");
  });

  it("Rule 3 (Structuring): flags when repeated transfers in 40,000-49,999 AED range", () => {
    const structuringTransfer: Transfer = {
      ...baseTransfer,
      id: "tx-today",
      send_amount_minor: 4_800_000 // 48,000 AED (just below 50,000 threshold)
    };

    const previousStructuring: Transfer = {
      ...baseTransfer,
      id: "tx-yesterday",
      send_amount_minor: 4_900_000 // 49,000 AED
    };

    const result = ruleStructuring(structuringTransfer, [previousStructuring]);
    expect(result.score).toBe(45);
    expect(result.rule).toBe("SUSPECTED_STRUCTURING");

    // Should not flag if single one
    const singleResult = ruleStructuring(structuringTransfer, []);
    expect(singleResult.score).toBe(0);
  });

  it("Rule 4 (High-Risk Country): flags when destination is on FATF high-risk watch-list", () => {
    const safeResult = ruleHighRiskCountry(baseTransfer);
    expect(safeResult.score).toBe(0);

    const sanctionedResult = ruleHighRiskCountry({
      ...baseTransfer,
      recipient_details: { name: "Sanctioned Entity", country: "IRN" }
    });
    expect(sanctionedResult.score).toBe(80);
    expect(sanctionedResult.rule).toBe("HIGH_RISK_JURISDICTION");
  });

  it("Rule 5 (New Account Large Amount): flags first-time transfer >= 10,000 AED", () => {
    const normal = ruleNewAccountLargeAmount(baseTransfer, 1);
    expect(normal.score).toBe(0);

    const largeFirstTransfer = ruleNewAccountLargeAmount(
      { ...baseTransfer, send_amount_minor: 1_200_000 }, // 12,000 AED
      1 // First transfer
    );
    expect(largeFirstTransfer.score).toBe(30);
    expect(largeFirstTransfer.rule).toBe("NEW_ACCOUNT_LARGE_TRANSACTION");
  });

  it("Composite Evaluation: assigns LOW, MEDIUM, or HIGH risk score and recommended action", () => {
    // 1. Clean small transfer -> LOW (score < 30)
    const lowRisk = evaluateAmlRules({
      transfer: baseTransfer,
      recentTransfers24h: [],
      userTotalTransfersCount: 5
    });
    expect(lowRisk.riskLevel).toBe("LOW");
    expect(lowRisk.recommendedAction).toBe("PASS");

    // 2. High value + Velocity -> MEDIUM/HIGH (score >= 70 -> HOLD)
    const highRisk = evaluateAmlRules({
      transfer: { ...baseTransfer, send_amount_minor: 5_000_000 },
      recentTransfers24h: [baseTransfer, baseTransfer, baseTransfer],
      userTotalTransfersCount: 5
    });
    expect(highRisk.riskScore).toBe(75); // 40 + 35
    expect(highRisk.riskLevel).toBe("HIGH");
    expect(highRisk.recommendedAction).toBe("HOLD");
  });
});
