/**
 * Configuration for the RateMyProfessors API client.
 *
 * This module defines the shape of `RMPClientConfig`, default URLs and settings,
 * and helpers to build config from defaults or environment variables. All client
 * behavior (base URLs, timeouts, retries, rate limiting) is driven by this config.
 */

/** Default GraphQL API base URL (used for search and ratings pagination). */
export const DEFAULT_BASE_URL = "https://www.ratemyprofessors.com/graphql";
/** Default URL prefix for professor profile pages (e.g. /professor/123). */
export const DEFAULT_PROFESSORS_PAGE_URL = "https://www.ratemyprofessors.com/professor/";
/** Default URL prefix for school profile pages. */
export const DEFAULT_SCHOOLS_PAGE_URL = "https://www.ratemyprofessors.com/school/";
/** Default URL prefix for the single-school compare view. */
export const DEFAULT_COMPARE_SCHOOLS_PAGE_URL = "https://www.ratemyprofessors.com/compare/schools/";
/** Default URL for the professor search page (HTML + embedded relay store). */
export const DEFAULT_SEARCH_PROFESSORS_PAGE_URL = "https://www.ratemyprofessors.com/search/professors/";
/** Default URL for the school search page. */
export const DEFAULT_SEARCH_SCHOOLS_PAGE_URL = "https://www.ratemyprofessors.com/search/schools/";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0";

/**
 * Full configuration for {@link RMPClient}.
 * All fields are required; use {@link createConfig} or {@link configFromEnv} to build.
 */
export interface RMPClientConfig {
  /** GraphQL endpoint base URL. */
  base_url: string;
  /** Professor profile page URL (without trailing slash). */
  professors_page_url: string;
  /** School profile page URL. */
  schools_page_url: string;
  /** Compare-schools page URL. */
  compare_schools_page_url: string;
  /** Professor search page URL. */
  search_professors_page_url: string;
  /** School search page URL. */
  search_schools_page_url: string;
  /** Request timeout in seconds. */
  timeout_seconds: number;
  /** Max retries for failed requests (e.g. 5xx). */
  max_retries: number;
  /** Max requests per minute (token bucket). */
  rate_limit_per_minute: number;
  /** User-Agent sent on HTTP requests. */
  user_agent: string;
  /** Default headers merged into every request. */
  default_headers: Record<string, string>;
}

const defaultHeaders: Record<string, string> = {
  "User-Agent": DEFAULT_USER_AGENT,
  "Accept-Language": "en-US,en;q=0.5",
};

/**
 * Builds a full config by merging optional overrides onto defaults.
 * Use this when you want to set only a few options (e.g. rate_limit_per_minute).
 *
 * @param overrides - Partial config; only provided keys override defaults.
 * @returns A complete {@link RMPClientConfig} object.
 */
export function createConfig(overrides: Partial<RMPClientConfig> = {}): RMPClientConfig {
  return {
    base_url: DEFAULT_BASE_URL,
    professors_page_url: DEFAULT_PROFESSORS_PAGE_URL,
    schools_page_url: DEFAULT_SCHOOLS_PAGE_URL,
    compare_schools_page_url: DEFAULT_COMPARE_SCHOOLS_PAGE_URL,
    search_professors_page_url: DEFAULT_SEARCH_PROFESSORS_PAGE_URL,
    search_schools_page_url: DEFAULT_SEARCH_SCHOOLS_PAGE_URL,
    timeout_seconds: 10,
    max_retries: 3,
    rate_limit_per_minute: 60,
    user_agent: DEFAULT_USER_AGENT,
    default_headers: { ...defaultHeaders },
    ...overrides,
  };
}

/**
 * Builds config from environment variables where present; falls back to defaults otherwise.
 * Useful for scripts or servers where you set options via env (e.g. RMP_CLIENT_RATE_LIMIT_PER_MINUTE=30).
 *
 * Supported env vars:
 * - `RMP_CLIENT_BASE_URL` – GraphQL base URL
 * - `RMP_CLIENT_TIMEOUT_SECONDS` – Request timeout
 * - `RMP_CLIENT_MAX_RETRIES` – Max retries
 * - `RMP_CLIENT_RATE_LIMIT_PER_MINUTE` – Rate limit
 *
 * @returns A complete {@link RMPClientConfig} (same shape as {@link createConfig}).
 */
export function configFromEnv(): RMPClientConfig {
  const env = typeof process !== "undefined" ? process.env : undefined;
  const base_url = env?.RMP_CLIENT_BASE_URL || DEFAULT_BASE_URL;
  const timeout_seconds = env?.RMP_CLIENT_TIMEOUT_SECONDS != null
    ? Number(env.RMP_CLIENT_TIMEOUT_SECONDS) : 10;
  const max_retries = env?.RMP_CLIENT_MAX_RETRIES != null
    ? Number(env.RMP_CLIENT_MAX_RETRIES) : 3;
  const rate_limit_per_minute = env?.RMP_CLIENT_RATE_LIMIT_PER_MINUTE != null
    ? Number(env.RMP_CLIENT_RATE_LIMIT_PER_MINUTE) : 60;

  return createConfig({
    base_url,
    timeout_seconds,
    max_retries,
    rate_limit_per_minute,
  });
}
