/**
 * Optional ingestion helpers: sentiment, helpers, course_codes.
 * Import from ratemyprofessors-client/extras/helpers, etc.
 */

export {
  normalizeComment,
  isValidComment,
  type NormalizeOptions,
  type CommentIssue,
  type ValidationResult,
} from "./helpers.js";
export {
  cleanCourseLabel,
  buildCourseMapping,
} from "./courseCodes.js";
export {
  analyzeSentiment,
  type SentimentResult,
  type SentimentLabel,
} from "./sentiment.js";
