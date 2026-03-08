import { describe, it, expect } from "vitest";
import {
  createConfig,
  DEFAULT_BASE_URL,
  DEFAULT_PROFESSORS_PAGE_URL,
  DEFAULT_SCHOOLS_PAGE_URL,
  DEFAULT_COMPARE_SCHOOLS_PAGE_URL,
  DEFAULT_SEARCH_PROFESSORS_PAGE_URL,
  DEFAULT_SEARCH_SCHOOLS_PAGE_URL,
} from "../src/config.js";

describe("RMPClientConfig defaults", () => {
  it("default professors_page_url", () => {
    const config = createConfig();
    expect(config.professors_page_url).toBe(DEFAULT_PROFESSORS_PAGE_URL);
  });

  it("default schools_page_url", () => {
    const config = createConfig();
    expect(config.schools_page_url).toBe(DEFAULT_SCHOOLS_PAGE_URL);
  });

  it("default compare_schools_page_url", () => {
    const config = createConfig();
    expect(config.compare_schools_page_url).toBe(DEFAULT_COMPARE_SCHOOLS_PAGE_URL);
  });

  it("default search_professors_page_url", () => {
    const config = createConfig();
    expect(config.search_professors_page_url).toBe(DEFAULT_SEARCH_PROFESSORS_PAGE_URL);
  });

  it("default search_schools_page_url", () => {
    const config = createConfig();
    expect(config.search_schools_page_url).toBe(DEFAULT_SEARCH_SCHOOLS_PAGE_URL);
  });

  it("default base_url", () => {
    const config = createConfig();
    expect(config.base_url).toBe(DEFAULT_BASE_URL);
  });

  it("default headers include User-Agent and Accept-Language", () => {
    const config = createConfig();
    expect(config.default_headers["User-Agent"]).toBeDefined();
    expect(config.default_headers["Accept-Language"]).toBeDefined();
  });

  it("default timeout, retries, rate limit", () => {
    const config = createConfig();
    expect(config.timeout_seconds).toBe(10);
    expect(config.max_retries).toBe(3);
    expect(config.rate_limit_per_minute).toBe(60);
  });

  it("default user_agent contains Firefox", () => {
    const config = createConfig();
    expect(config.user_agent).toContain("Firefox");
  });
});
