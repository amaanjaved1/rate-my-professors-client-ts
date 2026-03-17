/**
 * Token-bucket rate limiter for the RMP client.
 *
 * The client allows a fixed number of requests per minute (capacity).
 * Tokens refill continuously at a constant rate (refillPerSecond). Each
 * request consumes one token (or more); if no token is available, consume()
 * either blocks until a token is available or throws {@link RateLimitError}
 * when block is false.
 */

import { RateLimitError } from "./errors.js";

/**
 * Token bucket: limits the rate of operations (e.g. HTTP requests) by
 * refilling tokens over time and requiring one token per operation.
 */
export class TokenBucket {
  private _tokens: number;
  private _lastRefill: number;
  private _capacity: number;
  private _refillPerSecond: number;

  /**
   * @param capacity - Max tokens (e.g. requests per minute).
   * @param refillPerSecond - Tokens added per second (e.g. capacity/60 for "per minute").
   */
  constructor(capacity: number, refillPerSecond: number) {
    this._capacity = capacity;
    this._refillPerSecond = refillPerSecond;
    this._tokens = capacity;
    this._lastRefill = now();
  }

  /**
   * Consumes one or more tokens. If not enough tokens are available:
   * - If block is true (default), waits (sleeps) until enough have refilled, then consumes.
   * - If block is false, throws {@link RateLimitError} immediately.
   *
   * @param amount - Number of tokens to consume (default 1).
   * @param block - If true, wait until tokens are available; if false, throw when insufficient.
   */
  async consume(amount: number = 1, block: boolean = true): Promise<void> {
    while (true) {
      this._refill();
      if (this._tokens >= amount) {
        this._tokens -= amount;
        return;
      }
      if (!block) {
        throw new RateLimitError("Local rate limit exceeded");
      }
      const needed = amount - this._tokens;
      const sleepMs = Math.max((needed / this._refillPerSecond) * 1000, 10);
      await sleep(sleepMs);
    }
  }

  /**
   * Updates token count based on elapsed time since last refill.
   * Caps at capacity so we never exceed the allowed rate.
   */
  private _refill(): void {
    const t = now();
    const elapsed = t - this._lastRefill;
    this._lastRefill = t;
    this._tokens = Math.min(
      this._capacity,
      this._tokens + elapsed * this._refillPerSecond
    );
  }
}

/** Seconds since a fixed reference (performance.now() or Date.now() / 1000). */
function now(): number {
  return typeof performance !== "undefined" ? performance.now() / 1000 : Date.now() / 1000;
}

/** Promise that resolves after the given number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
