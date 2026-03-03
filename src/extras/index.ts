/**
 * Optional ingestion helpers: sentiment, dedupe, course_codes.
 * Import from ratemyprofessors-client/extras/sentiment, etc.
 */

export {
  normalizeComment,
  isValidComment,
} from "./dedupe.js";
export {
  cleanCourseLabel,
  buildCourseMapping,
} from "./courseCodes.js";
export {
  analyzeSentiment,
  type SentimentResult,
  type SentimentLabel,
} from "./sentiment.js";
