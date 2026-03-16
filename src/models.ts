/**
 * Data models for RateMyProfessors API responses.
 *
 * These TypeScript interfaces describe the shapes returned by {@link RMPClient}
 * methods. They map from RMP’s internal fields (camelCase, various sources)
 * to a consistent, snake_case public API. All methods that return entities
 * (schools, professors, ratings) use these types.
 */

//------------------------------------------------------------------------------
// Schools
//------------------------------------------------------------------------------

/**
 * A school (university or college) as returned by search, getSchool, or compare.
 * Category fields (reputation, safety, etc.) are the same ones RMP uses for
 * school ratings and may be absent if not loaded.
 */
export interface School {
  id: string;
  name: string;
  location?: string | null;
  overall_quality?: number | null;
  num_ratings?: number | null;
  /** Category ratings (e.g. reputation, safety) when available. */
  reputation?: number | null;
  safety?: number | null;
  happiness?: number | null;
  facilities?: number | null;
  social?: number | null;
  location_rating?: number | null;
  clubs?: number | null;
  opportunities?: number | null;
  internet?: number | null;
  food?: number | null;
}

/**
 * A single school rating (review). Includes optional overall and per-category
 * scores, and thumbs up/down counts. Used in school ratings pages and iterators.
 */
export interface SchoolRating {
  date: Date;
  comment: string;
  overall?: number | null;
  /** Per-category scores (reputation, location, etc.) when present. */
  category_ratings?: Record<string, number> | null;
  thumbs_up?: number | null;
  thumbs_down?: number | null;
}

//------------------------------------------------------------------------------
// Professors
//------------------------------------------------------------------------------

/**
 * A professor (teacher) as returned by search, getProfessor, or ratings pages.
 * Includes aggregate stats and optional school; tags and rating_distribution
 * come from the profile page when loaded.
 */
export interface Professor {
  id: string;
  name: string;
  department?: string | null;
  school?: School | null;
  url?: string | null;
  overall_rating?: number | null;
  num_ratings?: number | null;
  percent_take_again?: number | null;
  level_of_difficulty?: number | null;
  tags: string[];
  rating_distribution?: Record<number, RatingDistributionBucket> | null;
}

/**
 * One bucket in the rating distribution (e.g. "5 stars: 10 reviews, 40%").
 */
export interface RatingDistributionBucket {
  count: number;
  percentage: number;
}

/**
 * A single professor rating (review). Quality/difficulty map to RMP’s clarity
 * and difficulty; details may contain for_credit, attendance, grade, textbook.
 */
export interface Rating {
  date: Date;
  comment: string;
  quality?: number | null;
  difficulty?: number | null;
  tags: string[];
  course_raw?: string | null;
  /** Optional fields such as for_credit, attendance, grade, textbook. */
  details?: Record<string, unknown> | null;
  thumbs_up?: number | null;
  thumbs_down?: number | null;
}

//------------------------------------------------------------------------------
// Paginated pages
//------------------------------------------------------------------------------

/**
 * One page of professor ratings. Use `next_cursor` with getProfessorRatingsPage
 * for the next page; after first load, "Load More" is served from cache (no extra request).
 */
export interface ProfessorRatingsPage {
  professor: Professor;
  ratings: Rating[];
  has_next_page: boolean;
  next_cursor: string | null;
}

/**
 * One page of school ratings. Same cursor/cache behavior as professor ratings.
 */
export interface SchoolRatingsPage {
  school: School;
  ratings: SchoolRating[];
  has_next_page: boolean;
  next_cursor: string | null;
}

//------------------------------------------------------------------------------
// Search results
//------------------------------------------------------------------------------

/**
 * Result of a professor search (or list by school). Total and next_cursor
 * are set when the search page provides them.
 */
export interface ProfessorSearchResult {
  professors: Professor[];
  total?: number | null;
  page: number;
  page_size: number;
  has_next_page: boolean;
  next_cursor?: string | null;
}

/**
 * Result of a school search.
 */
export interface SchoolSearchResult {
  schools: School[];
  total?: number | null;
  page: number;
  page_size: number;
  has_next_page: boolean;
  next_cursor?: string | null;
}

/**
 * Result of comparing two schools (same shape as two School objects).
 */
export interface CompareSchoolsResult {
  school_1: School;
  school_2: School;
}
