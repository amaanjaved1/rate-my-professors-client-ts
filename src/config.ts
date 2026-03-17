/**
 * Configuration for the RateMyProfessors API client.
 *
 * All client behavior (base URL, timeouts, retries, rate limiting) is driven
 * by {@link RMPClientConfig}. Build one with {@link createConfig} or
 * {@link configFromEnv}, then pass it to {@link RMPClient}.
 */

/** GraphQL endpoint URL. */
export const DEFAULT_BASE_URL = "https://www.ratemyprofessors.com/graphql";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0";

/**
 * Full configuration for {@link RMPClient}.
 * Use {@link createConfig} or {@link configFromEnv} to build.
 */
export interface RMPClientConfig {
  /** GraphQL endpoint URL. */
  base_url: string;
  /** Request timeout in seconds. */
  timeout_seconds: number;
  /** Max retries on 5xx or network errors. */
  max_retries: number;
  /** Max requests per minute (token bucket). */
  rate_limit_per_minute: number;
  /** User-Agent header value. */
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
 *
 * @param overrides - Partial config; only provided keys override defaults.
 * @returns A complete {@link RMPClientConfig}.
 */
export function createConfig(
  overrides: Partial<RMPClientConfig> = {}
): RMPClientConfig {
  return {
    base_url: DEFAULT_BASE_URL,
    timeout_seconds: 10,
    max_retries: 3,
    rate_limit_per_minute: 60,
    user_agent: DEFAULT_USER_AGENT,
    default_headers: { ...defaultHeaders },
    ...overrides,
  };
}

/**
 * Builds config from environment variables, falling back to defaults.
 *
 * Supported env vars:
 * - `RMP_CLIENT_BASE_URL` – GraphQL base URL
 * - `RMP_CLIENT_TIMEOUT_SECONDS` – Request timeout
 * - `RMP_CLIENT_MAX_RETRIES` – Max retries
 * - `RMP_CLIENT_RATE_LIMIT_PER_MINUTE` – Rate limit
 *
 * @returns A complete {@link RMPClientConfig}.
 */
export function configFromEnv(): RMPClientConfig {
  const env = typeof process !== "undefined" ? process.env : undefined;
  return createConfig({
    base_url: env?.RMP_CLIENT_BASE_URL || DEFAULT_BASE_URL,
    timeout_seconds:
      env?.RMP_CLIENT_TIMEOUT_SECONDS != null
        ? Number(env.RMP_CLIENT_TIMEOUT_SECONDS)
        : 10,
    max_retries:
      env?.RMP_CLIENT_MAX_RETRIES != null
        ? Number(env.RMP_CLIENT_MAX_RETRIES)
        : 3,
    rate_limit_per_minute:
      env?.RMP_CLIENT_RATE_LIMIT_PER_MINUTE != null
        ? Number(env.RMP_CLIENT_RATE_LIMIT_PER_MINUTE)
        : 60,
  });
}
