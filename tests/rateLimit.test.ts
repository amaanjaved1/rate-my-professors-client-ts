import { describe, it, expect } from "vitest";
import { TokenBucket } from "../src/rateLimit.js";
import { RateLimitError } from "../src/errors.js";

describe("TokenBucket.consume", () => {
  it("consumes without error", async () => {
    const bucket = new TokenBucket(10, 10);
    for (let i = 0; i < 5; i++) {
      await bucket.consume();
    }
  });

  it("exhausts capacity then block=false raises", async () => {
    const bucket = new TokenBucket(3, 1);
    for (let i = 0; i < 3; i++) {
      await bucket.consume();
    }
    await expect(bucket.consume(1, false)).rejects.toThrow(RateLimitError);
  });

  it("block=false raises when insufficient tokens", async () => {
    const bucket = new TokenBucket(1, 0.01);
    await bucket.consume();
    await expect(bucket.consume(1, false)).rejects.toThrow(RateLimitError);
  });

  it("block=false succeeds when tokens available", async () => {
    const bucket = new TokenBucket(2, 10);
    await bucket.consume(1, false);
    await bucket.consume(1, false);
  });

  it("refills over time", async () => {
    const bucket = new TokenBucket(2, 10);
    await bucket.consume();
    await bucket.consume();
    await new Promise((r) => setTimeout(r, 250));
    await bucket.consume(1, false);
    await bucket.consume(1, false);
  });

  it("consumes fractional amount", async () => {
    const bucket = new TokenBucket(10, 1);
    await bucket.consume(5);
    await bucket.consume(5);
    await expect(bucket.consume(1, false)).rejects.toThrow(RateLimitError);
  });
});
