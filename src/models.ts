/**
 * Data models for RateMyProfessors API responses.
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

export interface RatingDistributionBucket {
  count: number;
  percentage: number;
}

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

export interface Rating {
  date: Date;
  comment: string;
  quality?: number | null;
  difficulty?: number | null;
  tags: string[];
  course_raw?: string | null;
  details?: Record<string, unknown> | null;
  helpful?: number | null;
  thumbs_up?: number | null;
  thumbs_down?: number | null;
}

export interface ProfessorRatingsPage {
  professor: Professor;
  ratings: Rating[];
  has_next_page: boolean;
  next_cursor: string | null;
}

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

export interface SchoolRating {
  date: Date;
  comment: string;
  overall?: number | null;
  category_ratings?: Record<string, number> | null;
  helpful?: number | null;
  thumbs_up?: number | null;
  thumbs_down?: number | null;
}

export interface SchoolRatingsPage {
  school: School;
  ratings: SchoolRating[];
  has_next_page: boolean;
  next_cursor: string | null;
}
