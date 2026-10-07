import { BadRequestError } from "../utils/errors.js";

// Standard base exchange rates for supported remittance corridors
const BASE_FX_RATES: Record<string, number> = {
  "AED_INR": 22.705,
  "USD_INR": 83.250,
  "EUR_INR": 90.150,
  "GBP_INR": 105.400,
  "AED_USD": 0.2723,
  "USD_AED": 3.6725
};

// Default flat fee in minor units per source currency (e.g. 500 fils = 5.00 AED)
const FLAT_FEE_MINOR: Record<string, number> = {
  AED: 500, // 5 AED
  USD: 200, // 2 USD
  EUR: 200, // 2 EUR
  GBP: 150  // 1.50 GBP
};

// Percentage fee: 0.5% (50 basis points)
const PERCENTAGE_FEE_RATE = 0.005;

export interface QuoteCalculation {
  sourceCurrency: string;
  targetCurrency: string;
  sendAmountMinor: number;
  feeMinor: number;
  netConvertibleMinor: number;
  exchangeRate: number;
  receiveAmountMinor: number;
}

export class FxService {
  /**
   * Retrieves exchange rate with a simulated micro-drift (±0.05%)
   */
  public getRate(sourceCurrency: string, targetCurrency: string): number {
    const key = `${sourceCurrency.toUpperCase()}_${targetCurrency.toUpperCase()}`;
    const baseRate = BASE_FX_RATES[key];

    if (!baseRate) {
      // Check reverse rate
      const reverseKey = `${targetCurrency.toUpperCase()}_${sourceCurrency.toUpperCase()}`;
      const reverseBase = BASE_FX_RATES[reverseKey];
      if (reverseBase) {
        return Number((1 / reverseBase).toFixed(6));
      }
      throw new BadRequestError(
        `Unsupported currency corridor: ${sourceCurrency} to ${targetCurrency}`
      );
    }

    // Micro drift to simulate live market fluctuations
    const driftFactor = 1 + (Math.random() * 0.001 - 0.0005);
    return Number((baseRate * driftFactor).toFixed(6));
  }

  /**
   * Computes fees and net receive amount in integer minor units
   */
  public calculateQuote(
    sourceCurrency: string,
    targetCurrency: string,
    sendAmountMinor: number
  ): QuoteCalculation {
    if (sendAmountMinor <= 0) {
      throw new BadRequestError("Send amount must be greater than zero");
    }

    const sCurr = sourceCurrency.toUpperCase();
    const tCurr = targetCurrency.toUpperCase();

    const flatFee = FLAT_FEE_MINOR[sCurr] ?? 200;
    const percentageFee = Math.round(sendAmountMinor * PERCENTAGE_FEE_RATE);
    const totalFeeMinor = flatFee + percentageFee;

    if (sendAmountMinor <= totalFeeMinor) {
      throw new BadRequestError(
        `Send amount (${sendAmountMinor} minor units) must exceed minimum fees (${totalFeeMinor} minor units)`
      );
    }

    const netConvertibleMinor = sendAmountMinor - totalFeeMinor;
    const rate = this.getRate(sCurr, tCurr);
    const receiveAmountMinor = Math.round(netConvertibleMinor * rate);

    return {
      sourceCurrency: sCurr,
      targetCurrency: tCurr,
      sendAmountMinor,
      feeMinor: totalFeeMinor,
      netConvertibleMinor,
      exchangeRate: rate,
      receiveAmountMinor
    };
  }
}

export const fxService = new FxService();
