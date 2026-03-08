/**
 * RateMyProfessors API client – typed, retrying, rate-limited.
 */

export { RMPClient } from "./client.js";
export {
  createConfig,
  configFromEnv,
  DEFAULT_BASE_URL,
  DEFAULT_PROFESSORS_PAGE_URL,
  DEFAULT_SCHOOLS_PAGE_URL,
  DEFAULT_COMPARE_SCHOOLS_PAGE_URL,
  DEFAULT_SEARCH_PROFESSORS_PAGE_URL,
  DEFAULT_SEARCH_SCHOOLS_PAGE_URL,
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
  Rating,
  RatingDistributionBucket,
  ProfessorRatingsPage,
  ProfessorSearchResult,
  SchoolSearchResult,
  CompareSchoolsResult,
  SchoolRating,
  SchoolRatingsPage,
} from "./models.js";
export { TokenBucket } from "./rateLimit.js";
