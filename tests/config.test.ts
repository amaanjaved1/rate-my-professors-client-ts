import { describe, it, expect } from "vitest";
import { createConfig, configFromEnv, DEFAULT_BASE_URL } from "../src/config.js";

describe("createConfig defaults", () => {
  it("base_url", () => {
    expect(createConfig().base_url).toBe(DEFAULT_BASE_URL);
  });

  it("timeout, retries, rate limit", () => {
    const c = createConfig();
    expect(c.timeout_seconds).toBe(10);
    expect(c.max_retries).toBe(3);
    expect(c.rate_limit_per_minute).toBe(60);
  });

  it("default headers include User-Agent and Accept-Language", () => {
    const c = createConfig();
    expect(c.default_headers["User-Agent"]).toBeDefined();
    expect(c.default_headers["Accept-Language"]).toBeDefined();
  });

  it("user_agent contains Firefox", () => {
    expect(createConfig().user_agent).toContain("Firefox");
  });
});

describe("createConfig overrides", () => {
  it("overrides base_url", () => {
    const c = createConfig({ base_url: "https://custom.url/gql" });
    expect(c.base_url).toBe("https://custom.url/gql");
  });

  it("overrides rate_limit_per_minute", () => {
    const c = createConfig({ rate_limit_per_minute: 120 });
    expect(c.rate_limit_per_minute).toBe(120);
  });
});

describe("configFromEnv", () => {
  it("returns valid config with all fields", () => {
    const c = configFromEnv();
    expect(c.base_url).toBe(DEFAULT_BASE_URL);
    expect(c.timeout_seconds).toBe(10);
    expect(c.max_retries).toBe(3);
    expect(c.rate_limit_per_minute).toBe(60);
    expect(c.user_agent).toBeDefined();
    expect(c.default_headers).toBeDefined();
  });
});
