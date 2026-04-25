/**
 * High-level client for the RateMyProfessors (RMP) GraphQL API.
 *
 * All data is fetched via POST to https://www.ratemyprofessors.com/graphql.
 * Rate limiting, retries, and timeouts are handled by {@link HttpClient}.
 *
 * Call {@link RMPClient.close} when done to release resources.
 */

import type { RMPClientConfig } from "./config.js";
import { createConfig } from "./config.js";
import { ParsingError } from "./errors.js";
import { HttpClient } from "./http.js";
import type {
  CompareSchoolsResult,
  Professor,
  ProfessorRatingsPage,
  ProfessorSearchResult,
  Rating,
  School,
  SchoolRating,
  SchoolRatingsPage,
  SchoolSearchResult,
} from "./models.js";
import {
  RATINGS_LIST_QUERY,
  SCHOOL_RATINGS_LIST_QUERY,
  SCHOOL_SEARCH_RESULTS_QUERY,
  TEACHER_SEARCH_RESULTS_QUERY,
} from "./queries.js";

/** Generic key-value map used for raw GraphQL payloads and parsed nodes. */
type Mapping = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds the Relay global ID for a teacher node (base64 of "Teacher-<id>").
 * Used as the `id` variable in GraphQL queries for professor data.
 */
function teacherNodeId(professorId: string): string {
  return btoa(`Teacher-${professorId}`);
}

/**
 * Builds the Relay global ID for a school node (base64 of "School-<id>").
 * Used in GraphQL queries for school data.
 */
function schoolNodeId(schoolId: string): string {
  return btoa(`School-${schoolId}`);
}

/**
 * Builds a location string from city/state/country fields.
 * Returns null when no location data is available.
 */
function formatLocation(record: Mapping): string | null {
  const parts = [record.city, record.state, record.country].filter(
    (p): p is string => typeof p === "string" && p.trim() !== "",
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

/** Parses an unknown value to a finite number; returns null for null/undefined/NaN. */
function safeFloat(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Parses an unknown value to an integer; returns null for null/undefined/non-integer. */
function safeInt(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

/**
 * Parses RMP date strings (e.g. "2026-03-03 21:20:35 +0000 UTC") to a Date.
 * Uses only the date part at UTC midnight; invalid input falls back to the current date.
 */
function parseDate(dateStr: unknown): Date {
  if (typeof dateStr === "string") {
    const datePart = dateStr.includes(" ") ? dateStr.split(" ")[0] : dateStr;
    const d = new Date(datePart + "T00:00:00Z");
    if (!Number.isNaN(d.getTime())) return d;
  }
  console.warn(`rmp_client: could not parse date: ${String(dateStr)}, using current date`);
  return new Date();
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Main client for the RateMyProfessors GraphQL API.
 *
 * Use {@link createConfig} to build config, then instantiate.
 * All methods are async; call {@link close} when finished to release resources.
 */
export class RMPClient {
  private _config: RMPClientConfig;
  private _http: HttpClient | null = null;

  constructor(config?: RMPClientConfig | null) {
    this._config = config ?? createConfig();
  }

  private _getClient(): HttpClient {
    if (!this._http) {
      this._http = new HttpClient(this._config);
    }
    return this._http;
  }

  /**
   * Closes the HTTP client (aborts in-flight requests).
   * Safe to call multiple times.
   */
  async close(): Promise<void> {
    if (this._http) {
      this._http.close();
      this._http = null;
    }
  }

  /**
   * Sends a raw GraphQL payload to the RMP endpoint.
   * Use for custom queries when the high-level methods don't expose what you need.
   *
   * @param payload - Object with at least `query` and optionally `operationName`, `variables`.
   * @returns The full parsed response body.
   */
  async rawQuery(payload: Mapping): Promise<Record<string, unknown>> {
    return this._getClient().postJson("", payload as Record<string, unknown>);
  }

  // ---- School search ---------------------------------------------------------

  /**
   * Searches schools by name (SchoolSearchResultsPageQuery).
   *
   * @param query - Search string (e.g. "Stanford").
   * @param options - Optional page_size and cursor for pagination.
   * @returns Schools for this page plus total/has_next_page/next_cursor.
   */
  async searchSchools(
    query: string,
    options: { page_size?: number; cursor?: string | null } = {},
  ): Promise<SchoolSearchResult> {
    const count = options.page_size ?? 20;
    const cursor = options.cursor ?? "";

    const data = await this.rawQuery({
      operationName: "SchoolSearchResultsPageQuery",
      query: SCHOOL_SEARCH_RESULTS_QUERY,
      variables: { query: { text: query }, count, cursor },
    });

    const search = ((data.data as Mapping) ?? {}).search as Mapping | undefined;
    const conn = search?.schools as Mapping | undefined;
    if (!conn) {
      return {
        schools: [],
        total: null,
        page_size: 0,
        has_next_page: false,
        next_cursor: null,
      };
    }

    const edges = (conn.edges ?? []) as Mapping[];
    const pageInfo = (conn.pageInfo ?? {}) as Mapping;
    const schools: School[] = [];
    for (const edge of edges) {
      const node =
        typeof edge === "object" && edge !== null
          ? (edge.node as Mapping)
          : null;
      if (!node) continue;
      schools.push(this._parseSchoolNode(node));
    }

    return {
      schools,
      total: safeInt(conn.resultCount),
      page_size: schools.length,
      has_next_page: Boolean(pageInfo.hasNextPage),
      next_cursor:
        pageInfo.endCursor != null ? String(pageInfo.endCursor) : null,
    };
  }

  // ---- Professor search / listing --------------------------------------------

  /**
   * Searches professors by name (TeacherSearchResultsPageQuery).
   * Optionally restrict to a school via school_id.
   *
   * @param query - Search string (e.g. "Smith").
   * @param options - Optional school_id, page_size, cursor.
   * @returns Professors for this page plus total/has_next_page/next_cursor.
   */
  async searchProfessors(
    query: string,
    options: {
      school_id?: string | null;
      page_size?: number;
      cursor?: string | null;
    } = {},
  ): Promise<ProfessorSearchResult> {
    const count = options.page_size ?? 20;
    const cursor = options.cursor ?? "";
    const queryVar: Mapping = { text: query };
    if (options.school_id != null) {
      queryVar.schoolID = schoolNodeId(options.school_id);
    }

    const data = await this.rawQuery({
      operationName: "TeacherSearchResultsPageQuery",
      query: TEACHER_SEARCH_RESULTS_QUERY,
      variables: { query: queryVar, count, cursor },
    });

    const search = ((data.data as Mapping) ?? {}).search as Mapping | undefined;
    const conn = search?.teachers as Mapping | undefined;
    if (!conn) {
      return {
        professors: [],
        total: null,
        page_size: 0,
        has_next_page: false,
        next_cursor: null,
      };
    }

    const edges = (conn.edges ?? []) as Mapping[];
    const pageInfo = (conn.pageInfo ?? {}) as Mapping;
    const professors: Professor[] = [];
    for (const edge of edges) {
      const node =
        typeof edge === "object" && edge !== null
          ? (edge.node as Mapping)
          : null;
      if (!node) continue;
      professors.push(this._parseProfessorNode(node));
    }

    return {
      professors,
      total: safeInt(conn.resultCount),
      page_size: professors.length,
      has_next_page: Boolean(pageInfo.hasNextPage),
      next_cursor:
        pageInfo.endCursor != null ? String(pageInfo.endCursor) : null,
    };
  }

  /**
   * Lists professors for a given school. Convenience wrapper around
   * {@link searchProfessors} with school_id filtering.
   *
   * @param school_id - Legacy numeric school id.
   * @param options - Optional query text, page_size, cursor.
   */
  async listProfessorsForSchool(
    school_id: number,
    options: {
      query?: string | null;
      page_size?: number;
      cursor?: string | null;
    } = {},
  ): Promise<ProfessorSearchResult> {
    return this.searchProfessors(options.query || " ", {
      school_id: String(school_id),
      page_size: options.page_size ?? 20,
      cursor: options.cursor,
    });
  }

  /**
   * Async generator that yields all professors for a school, page by page.
   * Uses cursor-based pagination; stops when no more pages are available.
   */
  async *iterProfessorsForSchool(
    school_id: number,
    options: { query?: string | null; page_size?: number } = {},
  ): AsyncGenerator<Professor> {
    let cursor: string | null = null;
    while (true) {
      const result = await this.listProfessorsForSchool(school_id, {
        query: options.query,
        page_size: options.page_size ?? 20,
        cursor,
      });
      for (const prof of result.professors) {
        yield prof;
      }
      if (
        !result.has_next_page ||
        !result.next_cursor ||
        result.professors.length === 0
      )
        break;
      cursor = result.next_cursor;
    }
  }

  // ---- Professor details + ratings -------------------------------------------

  /**
   * Fetches a single professor by their legacy numeric id.
   * Uses the ratings list query with a minimal page size to retrieve
   * full teacher details in a single request.
   *
   * @param professorId - Legacy numeric id from search results or RMP URL.
   */
  async getProfessor(professorId: string): Promise<Professor> {
    const page = await this._fetchProfessorRatingsPage(professorId, {
      first: 1,
    });
    return page.professor;
  }

  /**
   * Fetches a single page of ratings for a professor. Default page size is 20.
   *
   * @param professorId - Legacy numeric id.
   * @param options - cursor: use page.next_cursor for the next page; page_size: default 20.
   */
  async getProfessorRatingsPage(
    professorId: string,
    options: {
      cursor?: string | null;
      page_size?: number;
      course_filter?: string | null;
    } = {},
  ): Promise<ProfessorRatingsPage> {
    return this._fetchProfessorRatingsPage(professorId, {
      after: options.cursor,
      first: options.page_size ?? 20,
      courseFilter: options.course_filter,
    });
  }

  /**
   * Async generator that yields all ratings for a professor.
   * Optional `since` stops yielding when a rating date is before that date.
   *
   * Assumes the API returns ratings newest-first.
   */
  async *iterProfessorRatings(
    professorId: string,
    options: {
      page_size?: number;
      since?: Date | null;
      course_filter?: string | null;
    } = {},
  ): AsyncGenerator<Rating> {
    const pageSize = options.page_size ?? 20;
    const since = options.since ?? null;
    let cursor: string | null = null;
    while (true) {
      const page = await this.getProfessorRatingsPage(professorId, {
        cursor,
        page_size: pageSize,
        course_filter: options.course_filter,
      });
      for (const rating of page.ratings) {
        // API returns ratings newest-first; stop when we pass the cutoff date.
        if (since && rating.date.getTime() <= since.getTime()) return;
        yield rating;
      }
      if (!page.has_next_page || !page.next_cursor) return;
      cursor = page.next_cursor;
    }
  }

  // ---- School details + ratings ----------------------------------------------

  /**
   * Fetches a single school by its legacy numeric id.
   * Uses the school ratings list query with a minimal page size to retrieve
   * full school details (including category summaries) in a single request.
   *
   * @param schoolId - Legacy numeric id from search results or RMP URL.
   */
  async getSchool(schoolId: string): Promise<School> {
    const page = await this._fetchSchoolRatingsPage(schoolId, { first: 1 });
    return page.school;
  }

  /**
   * Fetches two schools and returns them as a pair.
   * Each school is fetched with a separate GraphQL request (run in parallel).
   */
  async getCompareSchools(
    schoolId1: string,
    schoolId2: string,
  ): Promise<CompareSchoolsResult> {
    const [school_1, school_2] = await Promise.all([
      this.getSchool(schoolId1),
      this.getSchool(schoolId2),
    ]);
    return { school_1, school_2 };
  }

  /**
   * Fetches a single page of ratings for a school. Default page size is 20.
   *
   * @param schoolId - Legacy numeric id.
   * @param options - cursor: use page.next_cursor; page_size: default 20.
   */
  async getSchoolRatingsPage(
    schoolId: string,
    options: { cursor?: string | null; page_size?: number } = {},
  ): Promise<SchoolRatingsPage> {
    return this._fetchSchoolRatingsPage(schoolId, {
      after: options.cursor,
      first: options.page_size ?? 20,
    });
  }

  /**
   * Async generator that yields all ratings for a school.
   * Optional `since` stops when a rating date is before that date.
   *
   * Assumes the API returns ratings newest-first.
   */
  async *iterSchoolRatings(
    schoolId: string,
    options: { page_size?: number; since?: Date | null } = {},
  ): AsyncGenerator<SchoolRating> {
    const pageSize = options.page_size ?? 20;
    const since = options.since ?? null;
    let cursor: string | null = null;
    while (true) {
      const page = await this.getSchoolRatingsPage(schoolId, {
        cursor,
        page_size: pageSize,
      });
      for (const rating of page.ratings) {
        // API returns ratings newest-first; stop when we pass the cutoff date.
        if (since && rating.date.getTime() <= since.getTime()) return;
        yield rating;
      }
      if (!page.has_next_page || !page.next_cursor) return;
      cursor = page.next_cursor;
    }
  }

  // ---- Private GraphQL page fetchers -----------------------------------------

  private async _fetchProfessorRatingsPage(
    professorId: string,
    options: {
      after?: string | null;
      first?: number;
      courseFilter?: string | null;
    },
  ): Promise<ProfessorRatingsPage> {
    const nodeId = teacherNodeId(professorId);
    const variables: Mapping = {
      count: options.first ?? 20,
      id: nodeId,
      courseFilter: options.courseFilter ?? null,
    };
    if (options.after != null) variables.cursor = options.after;

    const data = await this.rawQuery({
      operationName: "RatingsListQuery",
      query: RATINGS_LIST_QUERY,
      variables,
    });

    const node = ((data.data as Mapping) ?? {}).node as Mapping | undefined;
    if (!node) {
      throw new ParsingError(
        "GraphQL response missing data.node (teacher not found or invalid id)",
      );
    }

    const schoolObj = node.school;
    const school: School | null =
      typeof schoolObj === "object" && schoolObj !== null
        ? this._parseSchoolNode(schoolObj as Mapping)
        : null;

    const name =
      [node.firstName, node.lastName].filter(Boolean).join(" ").trim() ||
      String(node.lastName ?? "Unknown");

    const professor: Professor = {
      id: String(node.legacyId ?? node.id ?? professorId),
      name: name || "Unknown",
      department: node.department != null ? String(node.department) : null,
      school,
      overall_rating: safeFloat(node.avgRating),
      num_ratings: safeInt(node.numRatings),
      percent_take_again: safeFloat(node.wouldTakeAgainPercent),
      level_of_difficulty: safeFloat(node.avgDifficulty),
      tags: [],
      rating_distribution: null,
    };

    const ratingsConn = (node.ratings ?? {}) as Mapping;
    const edges = (ratingsConn.edges ?? []) as Mapping[];
    const pageInfo = (ratingsConn.pageInfo ?? {}) as Mapping;
    const ratings: Rating[] = [];
    for (const edge of edges) {
      const r =
        typeof edge === "object" && edge !== null
          ? (edge.node as Mapping)
          : null;
      if (r) ratings.push(this._parseRatingNode(r));
    }

    return {
      professor,
      ratings,
      has_next_page: Boolean(pageInfo.hasNextPage),
      next_cursor:
        pageInfo.endCursor != null ? String(pageInfo.endCursor) : null,
    };
  }

  private async _fetchSchoolRatingsPage(
    schoolId: string,
    options: { after?: string | null; first?: number },
  ): Promise<SchoolRatingsPage> {
    const nodeId = schoolNodeId(schoolId);
    const variables: Mapping = {
      count: options.first ?? 20,
      id: nodeId,
    };
    if (options.after != null) variables.cursor = options.after;

    const data = await this.rawQuery({
      operationName: "SchoolRatingsListQuery",
      query: SCHOOL_RATINGS_LIST_QUERY,
      variables,
    });

    const node = ((data.data as Mapping) ?? {}).node as Mapping | undefined;
    if (!node) {
      throw new ParsingError(
        "GraphQL response missing data.node (school not found or invalid id)",
      );
    }

    const school = this._parseSchoolNode(node as Mapping);

    const ratingsConn = (node.ratings ?? {}) as Mapping;
    const edges = (ratingsConn.edges ?? []) as Mapping[];
    const pageInfo = (ratingsConn.pageInfo ?? {}) as Mapping;
    const ratings: SchoolRating[] = [];
    for (const edge of edges) {
      const r =
        typeof edge === "object" && edge !== null
          ? (edge.node as Mapping)
          : null;
      if (r) ratings.push(this._parseSchoolRatingNode(r));
    }

    return {
      school,
      ratings,
      has_next_page: Boolean(pageInfo.hasNextPage),
      next_cursor:
        pageInfo.endCursor != null ? String(pageInfo.endCursor) : null,
    };
  }

  // ---- Internal parsers -------------------------------------------------------

  private _parseProfessorNode(node: Mapping): Professor {
    const firstName = node.firstName as string | undefined;
    const lastName = node.lastName as string | undefined;
    const name =
      (node.name as string) ||
      [firstName, lastName].filter(Boolean).join(" ").trim() ||
      "Unknown";

    const schoolObj = node.school;
    const school: School | null =
      typeof schoolObj === "object" && schoolObj !== null
        ? this._parseSchoolNode(schoolObj as Mapping)
        : null;

    return {
      id: String(node.legacyId ?? node.id ?? ""),
      name,
      department: node.department != null ? String(node.department) : null,
      school,
      overall_rating: safeFloat(node.avgRating ?? node.overallRating),
      num_ratings: safeInt(node.numRatings),
      percent_take_again: safeFloat(
        node.wouldTakeAgainPercent ?? node.percentTakeAgain,
      ),
      level_of_difficulty: safeFloat(
        node.avgDifficulty ?? node.levelOfDifficulty,
      ),
      tags: [],
      rating_distribution: null,
    };
  }

  private _parseRatingNode(record: Mapping): Rating {
    const tags: string[] = [];
    if (typeof record.ratingTags === "string") {
      tags.push(
        ...record.ratingTags
          .split("--")
          .map((t: string) => t.trim())
          .filter(Boolean),
      );
    }

    const details: Record<string, unknown> = {};
    if (record.isForCredit != null) details.for_credit = record.isForCredit;
    if (record.attendanceMandatory != null)
      details.attendance = record.attendanceMandatory;
    if (record.grade != null) details.grade = record.grade;
    if (record.textbookUse != null) details.textbook = record.textbookUse;

    return {
      date: parseDate(record.date),
      comment: String(record.comment ?? ""),
      quality: safeFloat(record.clarityRating ?? record.helpfulRating),
      difficulty: safeFloat(record.difficultyRating),
      tags,
      course_raw: (record.class as string) ?? null,
      details: Object.keys(details).length > 0 ? details : null,
      thumbs_up: safeInt(record.thumbsUpTotal),
      thumbs_down: safeInt(record.thumbsDownTotal),
    };
  }

  private _parseSchoolNode(node: Mapping): School {
    const summary = node.summary as Mapping | undefined;
    return {
      id: String(node.legacyId ?? node.id ?? ""),
      name: String(node.name ?? ""),
      location: formatLocation(node),
      overall_quality: safeFloat(node.avgRatingRounded ?? node.avgRating),
      num_ratings: safeInt(node.numRatings),
      reputation: safeFloat(summary?.schoolReputation ?? node.reputation),
      safety: safeFloat(summary?.schoolSafety ?? node.safety),
      happiness: safeFloat(summary?.schoolSatisfaction ?? node.happiness),
      facilities: safeFloat(summary?.campusCondition ?? node.facilities),
      social: safeFloat(summary?.socialActivities ?? node.social),
      location_rating: safeFloat(
        summary?.campusLocation ?? node.location_rating,
      ),
      clubs: safeFloat(summary?.clubAndEventActivities ?? node.clubs),
      opportunities: safeFloat(
        summary?.careerOpportunities ?? node.opportunities,
      ),
      internet: safeFloat(summary?.internetSpeed ?? node.internet),
      food: safeFloat(summary?.foodQuality ?? node.food),
    };
  }

  private _parseSchoolRatingNode(record: Mapping): SchoolRating {
    const rmpToCategory: [string, string][] = [
      ["reputationRating", "reputation"],
      ["locationRating", "location"],
      ["opportunitiesRating", "opportunities"],
      ["facilitiesRating", "facilities"],
      ["internetRating", "internet"],
      ["foodRating", "food"],
      ["clubsRating", "clubs"],
      ["socialRating", "social"],
      ["happinessRating", "happiness"],
      ["safetyRating", "safety"],
    ];

    let categoryRatings: Record<string, number> | null = null;
    for (const [rmpKey, catKey] of rmpToCategory) {
      const f = safeFloat(record[rmpKey]);
      if (f != null) {
        if (!categoryRatings) categoryRatings = {};
        categoryRatings[catKey] = f;
      }
    }

    let overall: number | null = null;
    if (categoryRatings) {
      const vals = Object.values(categoryRatings);
      overall = vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    return {
      date: parseDate(record.date),
      comment: String(record.comment ?? ""),
      overall,
      category_ratings: categoryRatings,
      thumbs_up: safeInt(record.thumbsUpTotal),
      thumbs_down: safeInt(record.thumbsDownTotal),
    };
  }
}
