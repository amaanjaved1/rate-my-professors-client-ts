import { describe, it, expect } from "vitest";
import { createConfig, DEFAULT_BASE_URL } from "../src/config.js";

describe("createConfig defaults", () => {
  it("base_url", () => {
    expect(createConfig().base_url).toBe(DEFAULT_BASE_URL);
  });

  it("timeout and retries", () => {
    const c = createConfig();
    expect(c.timeout_seconds).toBe(10);
    expect(c.max_retries).toBe(3);
  });

  it("default headers include User-Agent and Accept-Language", () => {
    const c = createConfig();
    expect(c.default_headers["User-Agent"]).toBeDefined();
    expect(c.default_headers["Accept-Language"]).toBeDefined();
  });

  it("user_agent contains Firefox", () => {
    expect(createConfig().user_agent).toContain("Firefox");
  });

  it("overrides base_url", () => {
    const c = createConfig({ base_url: "https://custom.url/gql" });
    expect(c.base_url).toBe("https://custom.url/gql");
  });

  it("overrides max_retries", () => {
    const c = createConfig({ max_retries: 5 });
    expect(c.max_retries).toBe(5);
  });
});
