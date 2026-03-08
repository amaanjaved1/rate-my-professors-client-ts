/**
 * Configuration for RMPClient.
 */

export const DEFAULT_BASE_URL = "https://www.ratemyprofessors.com/graphql";
export const DEFAULT_PROFESSORS_PAGE_URL = "https://www.ratemyprofessors.com/professor/";
export const DEFAULT_SCHOOLS_PAGE_URL = "https://www.ratemyprofessors.com/school/";
export const DEFAULT_COMPARE_SCHOOLS_PAGE_URL = "https://www.ratemyprofessors.com/compare/schools/";
export const DEFAULT_SEARCH_PROFESSORS_PAGE_URL = "https://www.ratemyprofessors.com/search/professors/";
export const DEFAULT_SEARCH_SCHOOLS_PAGE_URL = "https://www.ratemyprofessors.com/search/schools/";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0";

export interface RMPClientConfig {
  base_url: string;
  professors_page_url: string;
  schools_page_url: string;
  compare_schools_page_url: string;
  search_professors_page_url: string;
  search_schools_page_url: string;
  timeout_seconds: number;
  max_retries: number;
  rate_limit_per_minute: number;
  user_agent: string;
  default_headers: Record<string, string>;
}

const defaultHeaders: Record<string, string> = {
  "User-Agent": DEFAULT_USER_AGENT,
  "Accept-Language": "en-US,en;q=0.5",
};

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
 * Build config from environment variables where present.
 * Uses RMP_CLIENT_BASE_URL, RMP_CLIENT_TIMEOUT_SECONDS, RMP_CLIENT_MAX_RETRIES, RMP_CLIENT_RATE_LIMIT_PER_MINUTE.
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
