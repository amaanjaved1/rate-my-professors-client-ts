/**
 * Data models for RateMyProfessors API responses.
 */

//------------------------------------------------------------------------------

// For schools

export interface School {
  id: string;
  name: string;
  location?: string | null;
  overall_quality?: number | null;
  num_ratings?: number | null;
  // These are the categories that are rated for the school
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

export interface SchoolRating {
  date: Date;
  comment: string;
  overall?: number | null;
  category_ratings?: Record<string, number> | null; // These are the categories that are rated for the review
  thumbs_up?: number | null;
  thumbs_down?: number | null;
}

//------------------------------------------------------------------------------

// For professors

export interface Professor {
  id: string;
  name: string;
  department?: string | null;
  school?: School | null;
  url?: string | null;
  overall_rating?: number | null;
  num_ratings?: number | null; // The number of ratings for the professor
  percent_take_again?: number | null;
  level_of_difficulty?: number | null;
  tags: string[];
  rating_distribution?: Record<number, RatingDistributionBucket> | null;
}

export interface RatingDistributionBucket {
  count: number;
  percentage: number;
}

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

// For pages

export interface ProfessorRatingsPage {
  professor: Professor;
  ratings: Rating[];
  has_next_page: boolean;
  next_cursor: string | null;
}

export interface SchoolRatingsPage {
  school: School;
  ratings: SchoolRating[];
  has_next_page: boolean;
  next_cursor: string | null;
}

//------------------------------------------------------------------------------

// For search results

export interface ProfessorSearchResult {
  professors: Professor[];
  total?: number | null;
  page: number;
  page_size: number;
  has_next_page: boolean;
  next_cursor?: string | null;
}

export interface SchoolSearchResult {
  schools: School[];
  total?: number | null;
  page: number;
  page_size: number;
  has_next_page: boolean;
  next_cursor?: string | null;
}

export interface CompareSchoolsResult {
  school_1: School;
  school_2: School;
}
