/**
 * RateMyProfessors API client – public entry point.
 *
 * This package provides a typed, retrying, rate-limited client for the
 * unofficial RateMyProfessors APIs. You can search schools and professors,
 * fetch professor/school details and ratings, and run raw GraphQL queries.
 *
 * Quick start:
 * ```ts
 * import { RMPClient, createConfig } from "ratemyprofessors-client";
 * const client = new RMPClient(createConfig({ rate_limit_per_minute: 30 }));
 * const result = await client.searchProfessors("Smith");
 * await client.close();
 * ```
 *
 * All exports are re-exported from their source modules so consumers
 * need only depend on this entry point.
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
