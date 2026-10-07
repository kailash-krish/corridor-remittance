import { logger } from "./logger.js";

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitter?: boolean;
}

/**
 * Executes an asynchronous operation with exponential backoff and jitter
 */
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
  operationName = "Operation"
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const initialDelay = options.initialDelayMs ?? 50;
  const maxDelay = options.maxDelayMs ?? 1000;
  const factor = options.backoffFactor ?? 2;
  const useJitter = options.jitter ?? true;

  let attempt = 1;
  let currentDelay = initialDelay;

  while (attempt <= maxAttempts) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= maxAttempts) {
        logger.error(
          { error, attempt, maxAttempts, operationName },
          `❌ ${operationName} failed after ${maxAttempts} attempts`
        );
        throw error;
      }

      // Calculate jitter (between 0.75x and 1.25x)
      const jitterFactor = useJitter ? 0.75 + Math.random() * 0.5 : 1;
      const sleepMs = Math.min(maxDelay, Math.floor(currentDelay * jitterFactor));

      logger.warn(
        { attempt, maxAttempts, retryInMs: sleepMs, operationName },
        `⚠️ ${operationName} failed on attempt ${attempt}. Retrying in ${sleepMs}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, sleepMs));

      currentDelay *= factor;
      attempt += 1;
    }
  }

  throw new Error(`${operationName} reached unreachable retry branch`);
}
