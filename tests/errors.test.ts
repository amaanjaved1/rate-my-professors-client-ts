import { describe, it, expect } from "vitest";
import {
  RMPError,
  ConfigurationError,
  HttpError,
  ParsingError,
  RMPAPIError,
  RateLimitError,
  RetryError,
} from "../src/errors.js";

describe("RMPError hierarchy", () => {
  it("ConfigurationError is RMPError", () => {
    const err = new ConfigurationError("bad config");
    expect(err).toBeInstanceOf(RMPError);
    expect(err).toBeInstanceOf(ConfigurationError);
  });

  it("HttpError is RMPError", () => {
    const err = new HttpError(404, "http://example.com", "");
    expect(err).toBeInstanceOf(RMPError);
    expect(err).toBeInstanceOf(HttpError);
  });

  it("ParsingError is RMPError", () => {
    const err = new ParsingError("bad payload");
    expect(err).toBeInstanceOf(RMPError);
  });

  it("RMPAPIError is RMPError", () => {
    const err = new RMPAPIError("api err", []);
    expect(err).toBeInstanceOf(RMPError);
  });

  it("RateLimitError is RMPError", () => {
    const err = new RateLimitError("limit exceeded");
    expect(err).toBeInstanceOf(RMPError);
  });

  it("RetryError is RMPError", () => {
    const err = new RetryError(new Error("inner"));
    expect(err).toBeInstanceOf(RMPError);
  });
});

describe("HttpError", () => {
  it("stores status_code, url, body", () => {
    const err = new HttpError(404, "https://example.com/foo", "Not Found");
    expect(err.status_code).toBe(404);
    expect(err.url).toBe("https://example.com/foo");
    expect(err.body).toBe("Not Found");
  });

  it("message contains status and url", () => {
    const err = new HttpError(500, "https://api.test/");
    expect(String(err)).toContain("500");
    expect(String(err)).toContain("https://api.test/");
  });

  it("body is optional", () => {
    const err = new HttpError(403, "https://x.com");
    expect(err.body).toBeUndefined();
  });
});

describe("RetryError", () => {
  it("wraps last_error", () => {
    const inner = new Error("failed");
    const err = new RetryError(inner);
    expect(err.last_error).toBe(inner);
    expect(String(err).toLowerCase()).toMatch(/retries|failed/);
  });
});

describe("RMPAPIError", () => {
  it("stores details", () => {
    const details = [{ message: "Unauthorized" }];
    const err = new RMPAPIError("API error", details);
    expect(err.details).toEqual(details);
  });

  it("details is optional", () => {
    const err = new RMPAPIError("Generic error");
    expect(err.details).toBeUndefined();
  });
});

describe("ParsingError", () => {
  it("message is set", () => {
    const err = new ParsingError("Unexpected payload shape");
    expect(String(err)).toContain("Unexpected");
  });
});

describe("RateLimitError", () => {
  it("message is set", () => {
    const err = new RateLimitError("Local rate limit exceeded");
    expect(String(err).toLowerCase()).toContain("rate limit");
  });
});
