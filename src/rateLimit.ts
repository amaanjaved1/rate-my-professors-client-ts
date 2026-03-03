/**
 * Token-bucket rate limiter.
 */

import { RateLimitError } from "./errors.js";

export class TokenBucket {
  private _tokens: number;
  private _lastRefill: number;
  private _capacity: number;
  private _refillPerSecond: number;

  constructor(capacity: number, refillPerSecond: number) {
    this._capacity = capacity;
    this._refillPerSecond = refillPerSecond;
    this._tokens = capacity;
    this._lastRefill = now();
  }

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

function now(): number {
  return typeof performance !== "undefined" ? performance.now() / 1000 : Date.now() / 1000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
