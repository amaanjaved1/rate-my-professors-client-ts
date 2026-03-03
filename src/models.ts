/**
 * Data models for RateMyProfessors API responses.
 */

export interface School {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
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
}

export interface RatingSummary {
  overall_rating?: number | null;
  num_ratings: number;
  percent_take_again?: number | null;
  level_of_difficulty?: number | null;
}

export interface Rating {
  date: Date;
  comment: string;
  quality?: number | null;
  difficulty?: number | null;
  tags: string[];
  course_raw?: string | null;
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
}

export interface SchoolSearchResult {
  schools: School[];
  total?: number | null;
  page: number;
  page_size: number;
  has_next_page: boolean;
}
