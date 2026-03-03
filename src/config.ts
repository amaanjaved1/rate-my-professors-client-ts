/**
 * Configuration for RMPClient.
 */

export const DEFAULT_BASE_URL = "https://www.ratemyprofessors.com/graphql";

export interface RMPClientConfig {
  base_url: string;
  timeout_seconds: number;
  max_retries: number;
  rate_limit_per_minute: number;
  user_agent: string;
  default_headers: Record<string, string>;
}

const defaultHeaders: Record<string, string> = {
  "User-Agent": "ratemyprofessors-client/0.1.0",
  Referer: "https://www.ratemyprofessors.com/",
  Accept: "application/json",
};

export function createConfig(overrides: Partial<RMPClientConfig> = {}): RMPClientConfig {
  return {
    base_url: DEFAULT_BASE_URL,
    timeout_seconds: 10,
    max_retries: 3,
    rate_limit_per_minute: 60,
    user_agent: "ratemyprofessors-client/0.1.0",
    default_headers: { ...defaultHeaders },
    ...overrides,
  };
}

/**
 * Build config from environment variables where present.
 * Uses RMP_CLIENT_BASE_URL, RMP_CLIENT_TIMEOUT_SECONDS, RMP_CLIENT_MAX_RETRIES, RMP_CLIENT_RATE_LIMIT_PER_MINUTE.
 */
export function configFromEnv(): RMPClientConfig {
  const base_url =
    (typeof process !== "undefined" && process.env?.RMP_CLIENT_BASE_URL) || DEFAULT_BASE_URL;
  const timeout_raw =
    typeof process !== "undefined" ? process.env?.RMP_CLIENT_TIMEOUT_SECONDS : undefined;
  const retries_raw =
    typeof process !== "undefined" ? process.env?.RMP_CLIENT_MAX_RETRIES : undefined;
  const rate_raw =
    typeof process !== "undefined" ? process.env?.RMP_CLIENT_RATE_LIMIT_PER_MINUTE : undefined;

  const timeout_seconds = timeout_raw != null ? Number(timeout_raw) : 10;
  const max_retries = retries_raw != null ? Number(retries_raw) : 3;
  const rate_limit_per_minute = rate_raw != null ? Number(rate_raw) : 60;

  return createConfig({
    base_url,
    timeout_seconds,
    max_retries,
    rate_limit_per_minute,
  });
}
