import crypto from "node:crypto";
import { db } from "../db/repository.js";
import { Quote } from "../db/types.js";
import { fxService } from "./fxService.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";

// Quotes are guaranteed and locked for 60 seconds
const DEFAULT_QUOTE_TTL_SECONDS = 60;

export interface CreateQuoteInput {
  userId: string;
  sourceCurrency: string;
  targetCurrency: string;
  sendAmountMinor: number;
}

export interface QuoteResponse extends Quote {
  expiresInSeconds: number;
  status: "ACTIVE" | "EXPIRED" | "CONSUMED";
}

export class QuoteService {
  /**
   * Generates, locks, and persists an FX quote for 60 seconds
   */
  public async createQuote(input: CreateQuoteInput): Promise<QuoteResponse> {
    const calc = await fxService.calculateQuote(
      input.sourceCurrency,
      input.targetCurrency,
      input.sendAmountMinor
    );

    const now = new Date();
    const expiresAt = new Date(now.getTime() + DEFAULT_QUOTE_TTL_SECONDS * 1000);

    const quote: Quote = {
      id: crypto.randomUUID(),
      user_id: input.userId,
      source_currency: calc.sourceCurrency,
      target_currency: calc.targetCurrency,
      send_amount_minor: calc.sendAmountMinor,
      receive_amount_minor: calc.receiveAmountMinor,
      fee_minor: calc.feeMinor,
      exchange_rate: calc.exchangeRate,
      rate_provider: calc.rateProvider,
      rate_date: calc.rateDate,
      send_aed_minor: calc.sendAedMinor,
      expires_at: expiresAt.toISOString(),
      is_consumed: false,
      consumed_at: null,
      created_at: now.toISOString()
    };

    await db.quotes.insert(quote);
    return this.enrichQuote(quote);
  }

  /**
   * Fetches quote by ID and calculates its dynamic expiry status
   */
  public async getQuote(id: string): Promise<QuoteResponse> {
    const quote = await db.quotes.findById(id);
    if (!quote) {
      throw new NotFoundError(`Quote not found with ID: ${id}`);
    }
    return this.enrichQuote(quote);
  }

  /**
   * Retrieves quotes for a user
   */
  public async getUserQuotes(userId: string): Promise<QuoteResponse[]> {
    const quotes = await db.quotes.findByUserId(userId);
    return quotes.map((q) => this.enrichQuote(q));
  }

  /**
   * Validates and locks/consumes an unexpired quote for a transfer
   */
  public async validateAndConsumeQuote(id: string, userId: string): Promise<Quote> {
    const quote = await db.quotes.findById(id);
    if (!quote) {
      throw new NotFoundError(`Quote not found: ${id}`);
    }

    if (quote.user_id !== userId) {
      throw new BadRequestError("Quote does not belong to authenticated user");
    }

    if (quote.is_consumed) {
      throw new BadRequestError("Quote has already been consumed by an existing transfer");
    }

    const isExpired = new Date(quote.expires_at).getTime() < Date.now();
    if (isExpired) {
      throw new BadRequestError("Quote has expired. Please generate a new quote.");
    }

    await db.quotes.markConsumed(id);
    return {
      ...quote,
      is_consumed: true,
      consumed_at: new Date().toISOString()
    };
  }

  private enrichQuote(quote: Quote): QuoteResponse {
    const now = Date.now();
    const expiresAtMs = new Date(quote.expires_at).getTime();
    const remainingSeconds = Math.max(0, Math.floor((expiresAtMs - now) / 1000));

    let status: "ACTIVE" | "EXPIRED" | "CONSUMED" = "ACTIVE";
    if (quote.is_consumed) {
      status = "CONSUMED";
    } else if (remainingSeconds <= 0) {
      status = "EXPIRED";
    }

    return {
      ...quote,
      expiresInSeconds: remainingSeconds,
      status
    };
  }
}

export const quoteService = new QuoteService();
