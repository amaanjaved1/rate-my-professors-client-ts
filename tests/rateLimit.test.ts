import { describe, it, expect } from "vitest";
import { TokenBucket } from "../src/rateLimit.js";

describe("TokenBucket.consume", () => {
  it("consumes without error", async () => {
    const bucket = new TokenBucket(10, 10);
    for (let i = 0; i < 5; i++) {
      await bucket.consume();
    }
  });

  it("refills over time", async () => {
    const bucket = new TokenBucket(2, 10);
    await bucket.consume();
    await bucket.consume();
    await new Promise((r) => setTimeout(r, 250));
    await bucket.consume();
    await bucket.consume();
  });

  it("consume amount", async () => {
    const bucket = new TokenBucket(10, 1);
    await bucket.consume(5);
    await bucket.consume(5);
  });
});
