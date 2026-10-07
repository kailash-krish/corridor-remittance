/**
 * conversion.ts
 *
 * Handles currency and token unit scaling conversions.
 *
 * SPECIFICATION:
 * - Backend AED minor units: 2 decimals (1 AED = 100 fils).
 * - On-chain RMTS token: 6 decimals (1 RMTS = 1,000,000 token units).
 * - Scaling factor: 10^(6 - 2) = 10^4 = 10,000.
 *
 * Example:
 * 100.50 AED = 10,050 fils
 * On-chain = 10,050 * 10,000 = 100,500,000 units (100.500000 RMTS)
 */

export const DECIMALS_AED_MINOR = 2;
export const DECIMALS_TOKEN = 6;
export const SCALE_FACTOR = BigInt(10 ** (DECIMALS_TOKEN - DECIMALS_AED_MINOR)); // 10,000

/**
 * Converts backend AED minor units (fils) to on-chain token units (6 decimals).
 * @param amountMinor - integer minor units (e.g. 10000 for 100 AED)
 */
export function minorUnitsToTokenUnits(amountMinor: number | bigint): bigint {
  const minor = BigInt(amountMinor);
  if (minor < 0n) {
    throw new Error("Amount must be non-negative");
  }
  return minor * SCALE_FACTOR;
}

/**
 * Converts on-chain token units (6 decimals) back to AED minor units (fils, 2 decimals).
 * @param tokenUnits - on-chain units (e.g. 100,000,000)
 */
export function tokenUnitsToMinorUnits(tokenUnits: bigint): number {
  if (tokenUnits < 0n) {
    throw new Error("Amount must be non-negative");
  }
  const minor = tokenUnits / SCALE_FACTOR;
  return Number(minor);
}

/**
 * Formats token units as human-readable string (e.g. "100.50 RMTS")
 */
export function formatTokenUnits(tokenUnits: bigint): string {
  const divisor = BigInt(10 ** DECIMALS_TOKEN);
  const integerPart = tokenUnits / divisor;
  const fractionalPart = (tokenUnits % divisor).toString().padStart(DECIMALS_TOKEN, "0");
  return `${integerPart}.${fractionalPart}`;
}
