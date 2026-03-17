/**
 * Data models for RateMyProfessors API responses.
 *
 * These TypeScript interfaces describe the shapes returned by {@link RMPClient}
 * methods. All fields use snake_case. Numeric IDs are the legacy integer IDs
 * visible in RMP URLs; global Relay IDs are used internally only.
 */

//------------------------------------------------------------------------------
// Schools
//------------------------------------------------------------------------------

/**
 * A school (university or college) as returned by search, getSchool, or compare.
 * Category fields (reputation, safety, etc.) are populated by getSchool but may
 * be absent on search results where only basic data is returned.
 */
export interface School {
  id: string;
  name: string;
  location?: string | null;
  overall_quality?: number | null;
  num_ratings?: number | null;
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
 * A single school rating (review). `overall` is computed as the average of
 * all category scores. `category_ratings` maps category name to score.
 */
export interface SchoolRating {
  date: Date;
  comment: string;
  overall?: number | null;
  category_ratings?: Record<string, number> | null;
  thumbs_up?: number | null;
  thumbs_down?: number | null;
}

//------------------------------------------------------------------------------
// Professors
//------------------------------------------------------------------------------

/**
 * A professor (teacher) as returned by search, getProfessor, or ratings pages.
 * `tags` and `rating_distribution` are always empty/null in the current GraphQL
 * API responses; they are kept for forward compatibility.
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
 * One bucket in a professor's star-rating distribution (e.g. "5 stars: 10 reviews, 40%").
 */
export interface RatingDistributionBucket {
  count: number;
  percentage: number;
}

/**
 * A single professor rating (review). `quality` maps to RMP's clarity/helpful
 * rating; `details` may contain for_credit, attendance, grade, textbook when
 * the API returns them.
 */
export interface Rating {
  date: Date;
  comment: string;
  quality?: number | null;
  difficulty?: number | null;
  tags: string[];
  course_raw?: string | null;
  details?: Record<string, unknown> | null;
  thumbs_up?: number | null;
  thumbs_down?: number | null;
}

//------------------------------------------------------------------------------
// Paginated pages
//------------------------------------------------------------------------------

/**
 * One page of professor ratings. Pass `next_cursor` to the next
 * {@link RMPClient.getProfessorRatingsPage} call; subsequent pages are served
 * from an in-memory cache with no extra network requests.
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
 * Result of a professor search (or listing by school). Pagination uses
 * `next_cursor`; `total` reflects the server's result count when available.
 */
export interface ProfessorSearchResult {
  professors: Professor[];
  total?: number | null;
  page_size: number;
  has_next_page: boolean;
  next_cursor?: string | null;
}

/**
 * Result of a school search. Pagination uses `next_cursor`.
 */
export interface SchoolSearchResult {
  schools: School[];
  total?: number | null;
  page_size: number;
  has_next_page: boolean;
  next_cursor?: string | null;
}

/**
 * Result of comparing two schools.
 */
export interface CompareSchoolsResult {
  school_1: School;
  school_2: School;
}
