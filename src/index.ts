/**
 * RateMyProfessors API client – typed, retrying, rate-limited.
 */

export { RMPClient } from "./client.js";
export {
  createConfig,
  configFromEnv,
  DEFAULT_BASE_URL,
  type RMPClientConfig,
} from "./config.js";
export {
  RMPError,
  ConfigurationError,
  HttpError,
  RateLimitError,
  RetryError,
  RMPAPIError,
  ParsingError,
} from "./errors.js";
export type {
  School,
  Professor,
  RatingSummary,
  Rating,
  ProfessorRatingsPage,
  ProfessorSearchResult,
  SchoolSearchResult,
} from "./models.js";
export { TokenBucket } from "./rateLimit.js";
