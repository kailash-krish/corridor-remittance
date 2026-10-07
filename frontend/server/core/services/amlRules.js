"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ruleAmountOverThreshold = ruleAmountOverThreshold;
exports.ruleVelocity = ruleVelocity;
exports.ruleStructuring = ruleStructuring;
exports.ruleHighRiskCountry = ruleHighRiskCountry;
exports.ruleNewAccountLargeAmount = ruleNewAccountLargeAmount;
exports.evaluateAmlRules = evaluateAmlRules;
// FATF High-Risk & Monitored Jurisdictions (ISO-3)
const HIGH_RISK_COUNTRIES = new Set(["PRK", "IRN", "SYR", "MMR", "RUS"]);
// Thresholds in minor units (AED fils)
const HIGH_VALUE_THRESHOLD = 5_000_000; // 50,000 AED
const STRUCTURING_LOWER_BOUND = 4_000_000; // 40,000 AED
const NEW_ACCOUNT_HIGH_AMOUNT = 1_000_000; // 10,000 AED
/**
 * Pure Rule 1: Single transaction amount over threshold
 */
function ruleAmountOverThreshold(transfer) {
    if (transfer.source_currency === "AED" && transfer.send_amount_minor >= HIGH_VALUE_THRESHOLD) {
        return {
            rule: "AMOUNT_OVER_THRESHOLD",
            score: 40,
            reason: `Transaction amount (${transfer.send_amount_minor / 100} AED) exceeds mandatory threshold of 50,000 AED`
        };
    }
    return { rule: "AMOUNT_OVER_THRESHOLD", score: 0, reason: "" };
}
/**
 * Pure Rule 2: Transaction velocity (many transfers in 24 hours)
 */
function ruleVelocity(_transfer, recentTransfers24h) {
    if (recentTransfers24h.length >= 3) {
        return {
            rule: "VELOCITY_THRESHOLD_EXCEEDED",
            score: 35,
            reason: `High transaction frequency: user initiated ${recentTransfers24h.length} transfers within the last 24 hours`
        };
    }
    return { rule: "VELOCITY_THRESHOLD_EXCEEDED", score: 0, reason: "" };
}
/**
 * Pure Rule 3: Smurfing / Structuring (multiple transfers intentionally just below reporting threshold)
 */
function ruleStructuring(transfer, recentTransfers24h) {
    const isJustBelow = transfer.send_amount_minor >= STRUCTURING_LOWER_BOUND &&
        transfer.send_amount_minor < HIGH_VALUE_THRESHOLD;
    if (isJustBelow) {
        const previousJustBelow = recentTransfers24h.filter((t) => t.id !== transfer.id &&
            t.send_amount_minor >= STRUCTURING_LOWER_BOUND &&
            t.send_amount_minor < HIGH_VALUE_THRESHOLD);
        if (previousJustBelow.length > 0) {
            return {
                rule: "SUSPECTED_STRUCTURING",
                score: 45,
                reason: "Suspected structuring: repeated transfers between 40,000 and 49,999 AED to avoid 50,000 AED reporting threshold"
            };
        }
    }
    return { rule: "SUSPECTED_STRUCTURING", score: 0, reason: "" };
}
/**
 * Pure Rule 4: High-risk or sanctioned destination/source country
 */
function ruleHighRiskCountry(transfer) {
    const destCountry = (transfer.recipient_details.country || "").toUpperCase();
    const sourceCountry = (transfer.source_currency === "AED" ? "ARE" : "").toUpperCase();
    if (HIGH_RISK_COUNTRIES.has(destCountry) || HIGH_RISK_COUNTRIES.has(sourceCountry)) {
        return {
            rule: "HIGH_RISK_JURISDICTION",
            score: 80,
            reason: `Transfer targets or originates from high-risk jurisdiction (${destCountry || sourceCountry}) on sanctions watch-list`
        };
    }
    return { rule: "HIGH_RISK_JURISDICTION", score: 0, reason: "" };
}
/**
 * Pure Rule 5: New account with immediate large transfer
 */
function ruleNewAccountLargeAmount(transfer, userTotalTransfersCount) {
    // If first-ever transfer and amount > 10,000 AED
    if (userTotalTransfersCount <= 1 && transfer.send_amount_minor >= NEW_ACCOUNT_HIGH_AMOUNT) {
        return {
            rule: "NEW_ACCOUNT_LARGE_TRANSACTION",
            score: 30,
            reason: `New account first transaction (${transfer.send_amount_minor / 100} AED) exceeds 10,000 AED initial trust threshold`
        };
    }
    return { rule: "NEW_ACCOUNT_LARGE_TRANSACTION", score: 0, reason: "" };
}
/**
 * Evaluates all rules, sums the scores, and produces a composite assessment
 */
function evaluateAmlRules(params) {
    const { transfer, recentTransfers24h, userTotalTransfersCount } = params;
    const results = [
        ruleAmountOverThreshold(transfer),
        ruleVelocity(transfer, recentTransfers24h),
        ruleStructuring(transfer, recentTransfers24h),
        ruleHighRiskCountry(transfer),
        ruleNewAccountLargeAmount(transfer, userTotalTransfersCount)
    ];
    const triggered = results.filter((r) => r.score > 0);
    const totalScore = triggered.reduce((sum, r) => sum + r.score, 0);
    let riskLevel = "LOW";
    let recommendedAction = "PASS";
    if (totalScore >= 70) {
        riskLevel = "HIGH";
        recommendedAction = "HOLD";
    }
    else if (totalScore >= 30) {
        riskLevel = "MEDIUM";
        recommendedAction = "REVIEW";
    }
    else {
        riskLevel = "LOW";
        recommendedAction = "PASS";
    }
    return {
        riskScore: totalScore,
        riskLevel,
        triggeredRules: triggered,
        recommendedAction
    };
}
