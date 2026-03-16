/**
 * High-level client for RateMyProfessors.
 */

import type { RMPClientConfig } from "./config.js";
import { configFromEnv } from "./config.js";
import { ParsingError } from "./errors.js";
import { HttpClient } from "./http.js";
import type {
  CompareSchoolsResult,
  Professor,
  ProfessorRatingsPage,
  ProfessorSearchResult,
  Rating,
  RatingDistributionBucket,
  School,
  SchoolRating,
  SchoolRatingsPage,
  SchoolSearchResult,
} from "./models.js";
import {
  extractRelayStore,
  getAllRatingRecords,
  getAllSchoolRatingRecords,
  getProfessorNode,
  getProfessorRatingsConnectionPageInfo,
  getRatingsFromStore,
  getSchoolNode,
  getSchoolRatingsConnectionPageInfo,
  getSchoolRatingsFromStore,
  getSchoolSearchConnection,
  getSchoolSearchPageInfo,
  getSchoolSearchResultCount,
  getTeacherSearchConnection,
  getTeacherSearchPageInfo,
  getTeacherSearchResultCount,
  edgesToSchoolRecords,
  edgesToTeacherRecords,
  isRecordRef,
  resolveRef,
  resolveRefs,
} from "./relayStore.js";

type Mapping = Record<string, unknown>;

const TEACHER_RATINGS_QUERY = `
query TeacherRatings($id: ID!, $first: Int!, $after: String) {
  node(id: $id) {
    ... on Teacher {
      id
      legacyId
      firstName
      lastName
      department
      avgRating
      avgDifficulty
      numRatings
      wouldTakeAgainPercent
      school {
        id
        name
        city
        state
      }
      ratings(first: $first, after: $after) {
        edges {
          node {
            comment
            ratingTags
            clarityRating
            difficultyRating
            date
            grade
            thumbsUpTotal
            thumbsDownTotal
            class
            attendanceMandatory
            textbookUse
            isForCredit
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
}
`;

const SCHOOL_RATINGS_QUERY = `
query SchoolRatings($id: ID!, $first: Int!, $after: String) {
  node(id: $id) {
    ... on School {
      id
      legacyId
      name
      city
      state
      avgRatingRounded
      numRatings
      ratings(first: $first, after: $after) {
        edges {
          node {
            comment
            date
            reputationRating
            locationRating
            opportunitiesRating
            facilitiesRating
            internetRating
            foodRating
            clubsRating
            socialRating
            happinessRating
            safetyRating
            thumbsUpTotal
            thumbsDownTotal
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
}
`;

function teacherNodeId(professorId: string): string {
  return btoa(`Teacher-${professorId}`);
}

function schoolNodeId(schoolId: string): string {
  return btoa(`School-${schoolId}`);
}

function formatLocation(record: Mapping): string | null {
  const loc = record.location;
  if (typeof loc === "string" && loc.trim()) return loc.trim();
  const parts = [record.city, record.state, record.country].filter(
    (p): p is string => typeof p === "string" && p.trim() !== ""
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

function schoolRecordToLocationDict(record: Mapping): Mapping {
  return {
    id: record.id ?? record.__id,
    name: record.name ?? "",
    location: formatLocation(record),
  };
}

function safeFloat(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeInt(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function parseDate(dateStr: unknown): Date {
  if (typeof dateStr === "string") {
    // RMP sends "2026-03-03 21:20:35 +0000 UTC"; use date part only
    const datePart = dateStr.includes(" ") ? dateStr.split(" ")[0] : dateStr;
    const d = new Date(datePart + "T00:00:00Z");
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function buildRatingDistribution(
  raw: unknown
): Record<number, RatingDistributionBucket> | null {
  if (raw == null) return null;
  const counts: Record<number, number> = {};

  if (typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Mapping;
    const hasRKeys = [1, 2, 3, 4, 5].some(
      (i) => obj[`r${i}`] != null
    );
    if (hasRKeys) {
      for (let i = 1; i <= 5; i++) {
        const v = obj[`r${i}`];
        counts[i] = v != null ? Number(v) : 0;
      }
    } else {
      for (const [k, v] of Object.entries(obj)) {
        const level = Number(k);
        if (Number.isInteger(level) && level >= 1 && level <= 5) {
          counts[level] = v != null ? Number(v) : 0;
        }
      }
    }
  } else if (Array.isArray(raw) && raw.length >= 5) {
    for (let i = 0; i < 5; i++) {
      counts[i + 1] = raw[i] != null ? Number(raw[i]) : 0;
    }
  }

  if (Object.keys(counts).length === 0) return null;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  const result: Record<number, RatingDistributionBucket> = {};
  for (const [level, count] of Object.entries(counts).sort(
    ([a], [b]) => Number(a) - Number(b)
  )) {
    result[Number(level)] = {
      count,
      percentage: Math.round((100.0 * count) / total * 100) / 100,
    };
  }
  return result;
}

export class RMPClient {
  private _config: RMPClientConfig;
  private _http: HttpClient | null = null;
  /** Cache of all ratings per professor (filled on first page load so "Load More" needs no extra request). */
  private _professorRatingsCache = new Map<
    string,
    { professor: Professor; ratings: Rating[] }
  >();
  /** Cache of all ratings per school (filled on first page load so "Show More" needs no extra request). */
  private _schoolRatingsCache = new Map<
    string,
    { school: School; ratings: SchoolRating[] }
  >();

  constructor(config?: RMPClientConfig | null) {
    this._config = config ?? configFromEnv();
  }

  private _getClient(): HttpClient {
    if (!this._http) {
      this._http = new HttpClient(this._config);
    }
    return this._http;
  }

  async close(): Promise<void> {
    if (this._http) {
      this._http.close();
      this._http = null;
    }
    this._professorRatingsCache.clear();
    this._schoolRatingsCache.clear();
  }

  /** Send a raw JSON/GraphQL-style payload to the RMP backend. */
  async rawQuery(payload: Mapping): Promise<Record<string, unknown>> {
    return this._getClient().postJson("", payload as Record<string, unknown>);
  }

  // ---- School search ----------------------------------------------------------

  private _searchSchoolsPageUrl(query: string): string {
    const base = this._config.search_schools_page_url.replace(/\/$/, "");
    return `${base}?q=${encodeURIComponent(query)}`;
  }

  private async _fetchRelayStoreForSearchSchools(
    query: string
  ): Promise<Mapping> {
    const url = this._searchSchoolsPageUrl(query);
    const html = await this._getClient().getHtml(url);
    try {
      return extractRelayStore(html);
    } catch (e) {
      throw new ParsingError(
        `Failed to extract __RELAY_STORE__ from school search page: ${e}`
      );
    }
  }

  /** Search schools by name. */
  async searchSchools(
    query: string,
    options: { page?: number; page_size?: number } = {}
  ): Promise<SchoolSearchResult> {
    const page = options.page ?? 1;
    const pageSize = options.page_size ?? 20;

    const store = await this._fetchRelayStoreForSearchSchools(query);
    const conn = getSchoolSearchConnection(store);
    if (!conn) {
      return {
        schools: [],
        total: null,
        page,
        page_size: pageSize,
        has_next_page: false,
        next_cursor: null,
      };
    }

    const schoolRecords = edgesToSchoolRecords(store, conn.edges);
    const schools: School[] = schoolRecords.map((rec) => {
      const node = this._relaySchoolToNode(store, rec);
      return this._parseSchoolNode(node);
    });

    const total = getSchoolSearchResultCount(conn);
    const pageInfo = getSchoolSearchPageInfo(store, conn);
    const hasNext = pageInfo ? Boolean(pageInfo.hasNextPage) : false;
    const nextCursor = pageInfo
      ? (pageInfo.endCursor as string) ?? null
      : null;

    return {
      schools,
      total,
      page,
      page_size: schools.length,
      has_next_page: hasNext,
      next_cursor: nextCursor,
    };
  }

  // ---- Professor search / listing --------------------------------------------

  private _searchProfessorsPageUrl(query: string): string {
    const base = this._config.search_professors_page_url.replace(/\/$/, "");
    return `${base}?q=${encodeURIComponent(query)}`;
  }

  private async _fetchRelayStoreForSearchProfessors(
    query: string
  ): Promise<Mapping> {
    const url = this._searchProfessorsPageUrl(query);
    const html = await this._getClient().getHtml(url);
    try {
      return extractRelayStore(html);
    } catch (e) {
      throw new ParsingError(
        `Failed to extract __RELAY_STORE__ from search page: ${e}`
      );
    }
  }

  /** Search professors by name and optional school. */
  async searchProfessors(
    query: string,
    options: {
      school_id?: string | null;
      page?: number;
      page_size?: number;
    } = {}
  ): Promise<ProfessorSearchResult> {
    const page = options.page ?? 1;
    const pageSize = options.page_size ?? 20;

    const store = await this._fetchRelayStoreForSearchProfessors(query);
    const conn = getTeacherSearchConnection(store);
    if (!conn) {
      return {
        professors: [],
        total: null,
        page,
        page_size: pageSize,
        has_next_page: false,
        next_cursor: null,
      };
    }

    const teacherRecords = edgesToTeacherRecords(store, conn.edges);
    const professors: Professor[] = teacherRecords.map((rec) => {
      const node = this._relayProfessorToNode(store, rec);
      return this._parseProfessorNode(node);
    });

    const total = getTeacherSearchResultCount(conn);
    const pageInfo = getTeacherSearchPageInfo(store, conn);
    const hasNext = pageInfo ? Boolean(pageInfo.hasNextPage) : false;
    const nextCursor = pageInfo
      ? (pageInfo.endCursor as string) ?? null
      : null;

    return {
      professors,
      total,
      page,
      page_size: professors.length,
      has_next_page: hasNext,
      next_cursor: nextCursor,
    };
  }

  /** List professors for a given school. */
  async listProfessorsForSchool(
    school_id: number,
    options: {
      query?: string | null;
      page?: number;
      page_size?: number;
    } = {}
  ): Promise<ProfessorSearchResult> {
    return this.searchProfessors(options.query ?? "*", {
      school_id: String(school_id),
      page: options.page ?? 1,
      page_size: options.page_size ?? 20,
    });
  }

  /** Iterate all professors for a school (async generator). */
  async *iterProfessorsForSchool(
    school_id: number,
    options: { query?: string | null; page_size?: number } = {}
  ): AsyncGenerator<Professor> {
    const pageSize = options.page_size ?? 20;
    let page = 1;
    while (true) {
      const result = await this.listProfessorsForSchool(school_id, {
        query: options.query,
        page,
        page_size: pageSize,
      });
      if (result.professors.length === 0) break;
      for (const prof of result.professors) {
        yield prof;
      }
      if (!result.has_next_page) break;
      page++;
    }
  }

  // ---- Professor details + ratings -------------------------------------------

  private _professorPageUrl(professorId: string): string {
    const base = this._config.professors_page_url.replace(/\/$/, "");
    return `${base}/${professorId}`;
  }

  private async _fetchRelayStoreForProfessor(
    professorId: string
  ): Promise<Mapping> {
    const url = this._professorPageUrl(professorId);
    const html = await this._getClient().getHtml(url);
    try {
      return extractRelayStore(html);
    } catch (e) {
      throw new ParsingError(
        `Failed to extract __RELAY_STORE__ from professor page: ${e}`
      );
    }
  }

  /** Fetch detailed information about a single professor. */
  async getProfessor(professorId: string): Promise<Professor> {
    const store = await this._fetchRelayStoreForProfessor(professorId);
    const record = getProfessorNode(store, professorId);
    if (!record) {
      throw new ParsingError(
        `Professor record not found in __RELAY_STORE__ for id=${professorId}`
      );
    }
    const node = this._relayProfessorToNode(store, record);
    return this._parseProfessorNode(node);
  }

  private async _fetchProfessorRatingsViaGraphql(
    professorId: string,
    options: { after?: string | null; first?: number }
  ): Promise<ProfessorRatingsPage> {
    const nodeId = teacherNodeId(professorId);
    const variables: Mapping = {
      id: nodeId,
      first: options.first ?? 20,
    };
    if (options.after != null) variables.after = options.after;

    const data = await this.rawQuery({
      query: TEACHER_RATINGS_QUERY,
      variables,
    });

    const node = ((data.data as Mapping) ?? {}).node as Mapping | undefined;
    if (!node) {
      throw new ParsingError(
        "GraphQL response missing data.node (teacher not found or invalid id)"
      );
    }

    const schoolObj = node.school;
    let school: School | null = null;
    if (typeof schoolObj === "object" && schoolObj !== null) {
      const s = schoolObj as Mapping;
      school = {
        id: String(s.id ?? ""),
        name: String(s.name ?? ""),
        location: formatLocation(s),
      };
    }

    const name = [node.firstName, node.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

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
      if (!r) continue;
      const norm = this._relayRatingToNode(r);
      ratings.push(this._parseRatingNode(norm));
    }

    return {
      professor,
      ratings,
      has_next_page: Boolean(pageInfo.hasNextPage),
      next_cursor: pageInfo.endCursor != null
        ? String(pageInfo.endCursor)
        : null,
    };
  }

  /** Fetch a single page of ratings for a professor (5 at a time by default; "Load More" is served from cache, no extra network request). */
  async getProfessorRatingsPage(
    professorId: string,
    options: { cursor?: string | null; page_size?: number } = {}
  ): Promise<ProfessorRatingsPage> {
    const pageSize = options.page_size ?? 5;
    const cursor = options.cursor ?? null;

    // Numeric cursor: serve from cache (no network)
    if (cursor !== null && /^\d+$/.test(cursor)) {
      const cached = this._professorRatingsCache.get(professorId);
      if (cached) {
        const start = Math.max(0, Number(cursor));
        const pageSlice = cached.ratings.slice(start, start + pageSize);
        const hasNext = start + pageSize < cached.ratings.length;
        return {
          professor: cached.professor,
          ratings: pageSlice,
          has_next_page: hasNext,
          next_cursor: hasNext ? String(start + pageSize) : null,
        };
      }
    }

    // Non-numeric cursor (legacy GraphQL cursor): one GraphQL request
    if (cursor !== null && !/^\d+$/.test(cursor)) {
      return this._fetchProfessorRatingsViaGraphql(professorId, {
        after: cursor,
        first: pageSize,
      });
    }

    // First page: check cache so repeated "first page" calls don't refetch
    const cached = this._professorRatingsCache.get(professorId);
    if (cached) {
      const pageSlice = cached.ratings.slice(0, pageSize);
      const hasNext = cached.ratings.length > pageSize;
      return {
        professor: cached.professor,
        ratings: pageSlice,
        has_next_page: hasNext,
        next_cursor: hasNext ? String(pageSize) : null,
      };
    }

    // Fetch HTML and build initial list
    const store = await this._fetchRelayStoreForProfessor(professorId);
    const record = getProfessorNode(store, professorId);
    if (!record) {
      throw new ParsingError(
        `Professor record not found in __RELAY_STORE__ for id=${professorId}`
      );
    }

    const professor = this._parseProfessorNode(
      this._relayProfessorToNode(store, record)
    );
    let ratingRecords = getRatingsFromStore(store, record);
    if (ratingRecords.length === 0) {
      ratingRecords = getAllRatingRecords(store);
    }

    let ratingsModels: Rating[] = ratingRecords.map((r) =>
      this._parseRatingNode(this._relayRatingToNode(r))
    );

    const relayPageInfo = getProfessorRatingsConnectionPageInfo(
      store,
      record
    );

    // If there are more pages, fetch all via GraphQL so "Load More" needs no further request
    if (
      relayPageInfo &&
      relayPageInfo.hasNextPage &&
      relayPageInfo.endCursor != null
    ) {
      let after: string | null = String(relayPageInfo.endCursor);
      while (after != null) {
        const page = await this._fetchProfessorRatingsViaGraphql(professorId, {
          after,
          first: 100,
        });
        ratingsModels = ratingsModels.concat(page.ratings);
        after = page.has_next_page && page.next_cursor ? page.next_cursor : null;
      }
    }

    this._professorRatingsCache.set(professorId, { professor, ratings: ratingsModels });

    const pageSlice = ratingsModels.slice(0, pageSize);
    const hasNext = ratingsModels.length > pageSize;
    return {
      professor,
      ratings: pageSlice,
      has_next_page: hasNext,
      next_cursor: hasNext ? String(pageSize) : null,
    };
  }

  /** Iterate ratings for a professor (async generator). */
  async *iterProfessorRatings(
    professorId: string,
    options: { page_size?: number; since?: Date | null } = {}
  ): AsyncGenerator<Rating> {
    const pageSize = options.page_size ?? 20;
    const since = options.since ?? null;
    let cursor: string | null = null;
    while (true) {
      const page = await this.getProfessorRatingsPage(professorId, {
        cursor,
        page_size: pageSize,
      });
      for (const rating of page.ratings) {
        if (since && rating.date.getTime() <= since.getTime()) return;
        yield rating;
      }
      if (!page.has_next_page || !page.next_cursor) return;
      cursor = page.next_cursor;
    }
  }

  // ---- School details + ratings -----------------------------------------------

  private _schoolPageUrl(schoolId: string): string {
    const base = this._config.schools_page_url.replace(/\/$/, "");
    return `${base}/${schoolId}`;
  }

  private _compareSchoolPageUrl(schoolId: string): string {
    const base = this._config.compare_schools_page_url.replace(/\/$/, "");
    return `${base}/${schoolId}`;
  }

  private _compareSchoolsPageUrl(
    schoolId1: string,
    schoolId2: string
  ): string {
    const base = this._config.compare_schools_page_url.replace(/\/$/, "");
    return `${base}/${schoolId1}/${schoolId2}`;
  }

  private async _fetchRelayStoreForSchool(
    schoolId: string,
    options: { useCompareUrl?: boolean } = {}
  ): Promise<Mapping> {
    const url = options.useCompareUrl
      ? this._compareSchoolPageUrl(schoolId)
      : this._schoolPageUrl(schoolId);
    const html = await this._getClient().getHtml(url);
    try {
      return extractRelayStore(html);
    } catch (e) {
      throw new ParsingError(
        `Failed to extract __RELAY_STORE__ from school page: ${e}`
      );
    }
  }

  private async _fetchRelayStoreForCompareSchools(
    schoolId1: string,
    schoolId2: string
  ): Promise<Mapping> {
    const url = this._compareSchoolsPageUrl(schoolId1, schoolId2);
    const html = await this._getClient().getHtml(url);
    try {
      return extractRelayStore(html);
    } catch (e) {
      throw new ParsingError(
        `Failed to extract __RELAY_STORE__ from compare schools page: ${e}`
      );
    }
  }

  /** Fetch detailed information about a single school. */
  async getSchool(
    schoolId: string,
    options: { use_compare_page?: boolean } = {}
  ): Promise<School> {
    const store = await this._fetchRelayStoreForSchool(schoolId, {
      useCompareUrl: options.use_compare_page,
    });
    const record = getSchoolNode(store, schoolId);
    if (!record) {
      throw new ParsingError(
        `School record not found in __RELAY_STORE__ for id=${schoolId}`
      );
    }
    const node = this._relaySchoolToNode(store, record);
    return this._parseSchoolNode(node);
  }

  /** Fetch and compare two schools. */
  async getCompareSchools(
    schoolId1: string,
    schoolId2: string
  ): Promise<CompareSchoolsResult> {
    const store = await this._fetchRelayStoreForCompareSchools(
      schoolId1,
      schoolId2
    );
    const record1 = getSchoolNode(store, schoolId1);
    const record2 = getSchoolNode(store, schoolId2);
    if (!record1) {
      throw new ParsingError(
        `School record not found in __RELAY_STORE__ for id=${schoolId1}`
      );
    }
    if (!record2) {
      throw new ParsingError(
        `School record not found in __RELAY_STORE__ for id=${schoolId2}`
      );
    }
    return {
      school_1: this._parseSchoolNode(this._relaySchoolToNode(store, record1)),
      school_2: this._parseSchoolNode(this._relaySchoolToNode(store, record2)),
    };
  }

  private async _fetchSchoolRatingsViaGraphql(
    schoolId: string,
    options: { after?: string | null; first?: number }
  ): Promise<SchoolRatingsPage> {
    const nodeId = schoolNodeId(schoolId);
    const variables: Mapping = {
      id: nodeId,
      first: options.first ?? 20,
    };
    if (options.after != null) variables.after = options.after;

    const data = await this.rawQuery({
      query: SCHOOL_RATINGS_QUERY,
      variables,
    });

    const node = ((data.data as Mapping) ?? {}).node as Mapping | undefined;
    if (!node) {
      throw new ParsingError(
        "GraphQL response missing data.node (school not found or invalid id)"
      );
    }

    const school = this._parseSchoolNode({
      id: node.legacyId ?? node.id,
      name: node.name,
      location: formatLocation(node),
      overall_quality: node.avgRatingRounded,
      num_ratings: node.numRatings,
    });

    const ratingsConn = (node.ratings ?? {}) as Mapping;
    const edges = (ratingsConn.edges ?? []) as Mapping[];
    const pageInfo = (ratingsConn.pageInfo ?? {}) as Mapping;

    const ratings: SchoolRating[] = [];
    for (const edge of edges) {
      const r =
        typeof edge === "object" && edge !== null
          ? (edge.node as Mapping)
          : null;
      if (r) {
        ratings.push(this._parseSchoolRatingNode(r));
      }
    }

    return {
      school,
      ratings,
      has_next_page: Boolean(pageInfo.hasNextPage),
      next_cursor: pageInfo.endCursor != null
        ? String(pageInfo.endCursor)
        : null,
    };
  }

  /** Fetch a single page of ratings for a school (5 at a time by default; "Show More" is served from cache, no extra network request). */
  async getSchoolRatingsPage(
    schoolId: string,
    options: { cursor?: string | null; page_size?: number } = {}
  ): Promise<SchoolRatingsPage> {
    const pageSize = options.page_size ?? 5;
    const cursor = options.cursor ?? null;

    // Numeric cursor: serve from cache (no network)
    if (cursor !== null && /^\d+$/.test(cursor)) {
      const cached = this._schoolRatingsCache.get(schoolId);
      if (cached) {
        const start = Math.max(0, Number(cursor));
        const pageSlice = cached.ratings.slice(start, start + pageSize);
        const hasNext = start + pageSize < cached.ratings.length;
        return {
          school: cached.school,
          ratings: pageSlice,
          has_next_page: hasNext,
          next_cursor: hasNext ? String(start + pageSize) : null,
        };
      }
    }

    // Non-numeric cursor (legacy GraphQL cursor): one GraphQL request
    if (cursor !== null && !/^\d+$/.test(cursor)) {
      return this._fetchSchoolRatingsViaGraphql(schoolId, {
        after: cursor,
        first: pageSize,
      });
    }

    // First page: check cache so repeated "first page" calls don't refetch
    const cached = this._schoolRatingsCache.get(schoolId);
    if (cached) {
      const pageSlice = cached.ratings.slice(0, pageSize);
      const hasNext = cached.ratings.length > pageSize;
      return {
        school: cached.school,
        ratings: pageSlice,
        has_next_page: hasNext,
        next_cursor: hasNext ? String(pageSize) : null,
      };
    }

    // Fetch HTML and build initial list
    const store = await this._fetchRelayStoreForSchool(schoolId);
    const record = getSchoolNode(store, schoolId);
    if (!record) {
      throw new ParsingError(
        `School record not found in __RELAY_STORE__ for id=${schoolId}`
      );
    }

    const school = this._parseSchoolNode(
      this._relaySchoolToNode(store, record)
    );
    let ratingRecords = getSchoolRatingsFromStore(store, record);
    if (ratingRecords.length === 0) {
      ratingRecords = getAllSchoolRatingRecords(store);
    }

    let ratingsModels: SchoolRating[] = ratingRecords.map((r) =>
      this._parseSchoolRatingNode(r)
    );

    const relayPageInfo = getSchoolRatingsConnectionPageInfo(store, record);

    // If there are more pages, fetch all via GraphQL so "Show More" needs no further request
    if (
      relayPageInfo &&
      relayPageInfo.hasNextPage &&
      relayPageInfo.endCursor != null
    ) {
      let after: string | null = String(relayPageInfo.endCursor);
      while (after != null) {
        const page = await this._fetchSchoolRatingsViaGraphql(schoolId, {
          after,
          first: 100,
        });
        ratingsModels = ratingsModels.concat(page.ratings);
        after = page.has_next_page && page.next_cursor ? page.next_cursor : null;
      }
    }

    this._schoolRatingsCache.set(schoolId, { school, ratings: ratingsModels });

    const pageSlice = ratingsModels.slice(0, pageSize);
    const hasNext = ratingsModels.length > pageSize;
    return {
      school,
      ratings: pageSlice,
      has_next_page: hasNext,
      next_cursor: hasNext ? String(pageSize) : null,
    };
  }

  /** Iterate ratings for a school (async generator). */
  async *iterSchoolRatings(
    schoolId: string,
    options: { page_size?: number; since?: Date | null } = {}
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
        if (since && rating.date.getTime() <= since.getTime()) return;
        yield rating;
      }
      if (!page.has_next_page || !page.next_cursor) return;
      cursor = page.next_cursor;
    }
  }

  // ---- Internal relay-to-node converters --------------------------------------

  private _relayProfessorToNode(
    store: Mapping,
    record: Mapping
  ): Mapping {
    const firstName = record.firstName as string | undefined;
    const lastName = record.lastName as string | undefined;
    const node: Mapping = {
      id: record.id ?? record.__id ?? record.legacyId,
      name:
        (record.name as string) ||
        [firstName, lastName].filter(Boolean).join(" "),
      department: record.department,
      url: record.url,
      overallRating: record.avgRating ?? record.overallRating,
      numRatings: record.numRatings,
      percentTakeAgain:
        record.wouldTakeAgainPercent ?? record.percentTakeAgain,
      levelOfDifficulty:
        record.avgDifficulty ?? record.levelOfDifficulty,
      tags: (record.tags as string[]) ?? [],
    };

    const schoolVal = record.school;
    if (isRecordRef(schoolVal)) {
      const schoolRecord = resolveRef(store, schoolVal);
      if (schoolRecord) {
        node.school = schoolRecordToLocationDict(schoolRecord);
      }
    } else if (typeof schoolVal === "object" && schoolVal !== null) {
      node.school = schoolRecordToLocationDict(schoolVal as Mapping);
    }

    const distRaw =
      record.ratingsDistribution ?? record.ratingDistribution;
    if (isRecordRef(distRaw)) {
      const distRecord = resolveRef(store, distRaw);
      node.rating_distribution =
        distRecord && typeof distRecord === "object" ? distRecord : distRaw;
    } else {
      node.rating_distribution = distRaw;
    }

    const tagsRefs = record.teacherRatingTags;
    if (
      typeof tagsRefs === "object" &&
      tagsRefs !== null &&
      "__refs" in tagsRefs
    ) {
      const refIds =
        ((tagsRefs as Mapping).__refs as string[]) ?? [];
      const tagRecords = resolveRefs(store, refIds);
      node.tags = tagRecords
        .map((r) => String(r.tagName ?? ""))
        .filter(Boolean);
    } else if (!(node.tags as string[])?.length) {
      node.tags = (record.tags as string[]) ?? [];
    }

    return node;
  }

  private _relayRatingToNode(record: Mapping): Mapping {
    const out: Mapping = {
      date: record.date,
      comment: (record.comment as string) ?? "",
      quality: record.clarityRating ?? record.quality,
      difficulty: record.difficultyRating ?? record.difficulty,
      tags: (record.tags as string[]) ?? [],
      course:
        record.class ?? record.course ?? record.courseName,
    };

    if (typeof record.ratingTags === "string") {
      out.tags = (record.ratingTags as string)
        .split("--")
        .map((t: string) => t.trim())
        .filter(Boolean);
    }

    out.for_credit =
      "isForCredit" in record
        ? record.isForCredit
        : record.for_credit ?? record.forCredit;
    out.attendance =
      record.attendanceMandatory ?? record.attendance;
    out.grade = record.grade;
    out.textbook =
      "textbookUse" in record
        ? record.textbookUse
        : record.textbook;
    out.thumbsUp = record.thumbsUpTotal ?? record.thumbsUp;
    out.thumbsDown = record.thumbsDownTotal ?? record.thumbsDown;

    return out;
  }

  private _relaySchoolToNode(store: Mapping, record: Mapping): Mapping {
    const node: Mapping = {
      id: record.id ?? record.__id ?? record.legacyId,
      name: (record.name as string) ?? "",
      location: formatLocation(record),
      overall_quality:
        record.avgRatingRounded ??
        record.overallQuality ??
        record.overall,
      num_ratings: record.numRatings,
      reputation: record.reputation,
      safety: record.safety,
      happiness: record.happiness,
      facilities: record.facilities,
      social: record.social,
      location_rating: record.location,
      clubs: record.clubs,
      opportunities: record.opportunities,
      internet: record.internet,
      food: record.food,
    };

    const summaryRef = record.summary;
    if (isRecordRef(summaryRef)) {
      const summaryRecord = resolveRef(store, summaryRef);
      if (summaryRecord) {
        node.reputation =
          node.reputation ?? safeFloat(summaryRecord.schoolReputation);
        node.safety =
          node.safety ?? safeFloat(summaryRecord.schoolSafety);
        node.happiness =
          node.happiness ?? safeFloat(summaryRecord.schoolSatisfaction);
        node.facilities =
          node.facilities ?? safeFloat(summaryRecord.campusCondition);
        node.social =
          node.social ?? safeFloat(summaryRecord.socialActivities);
        node.location_rating =
          node.location_rating ?? safeFloat(summaryRecord.campusLocation);
        node.clubs =
          node.clubs ??
          safeFloat(summaryRecord.clubAndEventActivities);
        node.opportunities =
          node.opportunities ??
          safeFloat(summaryRecord.careerOpportunities);
        node.internet =
          node.internet ?? safeFloat(summaryRecord.internetSpeed);
        node.food =
          node.food ?? safeFloat(summaryRecord.foodQuality);
      }
    }

    return node;
  }

  // ---- Internal parsers -------------------------------------------------------

  private _parseProfessorNode(node: Mapping): Professor {
    const schoolInfo = node.school;
    let school: School | null = null;
    if (typeof schoolInfo === "object" && schoolInfo !== null) {
      const s = schoolInfo as Mapping;
      school = {
        id: String(s.id ?? ""),
        name: String(s.name ?? ""),
        location:
          typeof s.location === "string"
            ? s.location
            : formatLocation(s),
      };
    }

    const ratingDist = buildRatingDistribution(node.rating_distribution);

    const tagsRaw = node.tags;
    const tags = Array.isArray(tagsRaw)
      ? tagsRaw.map((t) => String(t))
      : [];

    return {
      id: String(node.id ?? ""),
      name: String(node.name ?? ""),
      department: node.department != null ? String(node.department) : null,
      school,
      url: node.url != null ? String(node.url) : null,
      overall_rating: safeFloat(node.overallRating),
      num_ratings: safeInt(node.numRatings),
      percent_take_again: safeFloat(node.percentTakeAgain),
      level_of_difficulty: safeFloat(node.levelOfDifficulty),
      tags,
      rating_distribution: ratingDist,
    };
  }

  private _parseRatingNode(node: Mapping): Rating {
    const ratingDate = parseDate(node.date);

    const tagsRaw = node.tags;
    const tags = Array.isArray(tagsRaw)
      ? tagsRaw.map((t) => String(t))
      : [];

    let details: Record<string, unknown> | null = null;
    const keyToSnake: Record<string, string> = { forCredit: "for_credit" };
    for (const key of [
      "for_credit",
      "forCredit",
      "attendance",
      "grade",
      "textbook",
    ]) {
      const val = node[key];
      if (val != null) {
        if (!details) details = {};
        details[keyToSnake[key] ?? key] = val;
      }
    }

    return {
      date: ratingDate,
      comment: String(node.comment ?? ""),
      quality: safeFloat(node.quality),
      difficulty: safeFloat(node.difficulty),
      tags,
      course_raw: (node.course as string) ?? null,
      details,
      thumbs_up: safeInt(node.thumbsUp ?? node.thumbs_up),
      thumbs_down: safeInt(node.thumbsDown ?? node.thumbs_down),
    };
  }

  private _parseSchoolNode(node: Mapping): School {
    const locationRating =
      safeFloat(node.location_rating) ??
      (typeof node.location === "number"
        ? safeFloat(node.location)
        : null);

    return {
      id: String(node.id ?? ""),
      name: String(node.name ?? ""),
      location:
        typeof node.location === "string"
          ? node.location
          : formatLocation(node),
      overall_quality: safeFloat(
        node.overall_quality ?? node.overallQuality ?? node.overall
      ),
      num_ratings: safeInt(node.num_ratings ?? node.numRatings),
      reputation: safeFloat(node.reputation),
      safety: safeFloat(node.safety),
      happiness: safeFloat(node.happiness),
      facilities: safeFloat(node.facilities),
      social: safeFloat(node.social),
      location_rating: locationRating,
      clubs: safeFloat(node.clubs),
      opportunities: safeFloat(node.opportunities),
      internet: safeFloat(node.internet),
      food: safeFloat(node.food),
    };
  }

  private _parseSchoolRatingNode(record: Mapping): SchoolRating {
    const ratingDate = parseDate(record.date);

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
      const val = record[rmpKey];
      if (val != null) {
        const f = safeFloat(val);
        if (f != null) {
          if (!categoryRatings) categoryRatings = {};
          categoryRatings[catKey] = f;
        }
      }
    }

    if (!categoryRatings) {
      const catKeys = [
        "reputation",
        "location",
        "opportunities",
        "facilities",
        "internet",
        "food",
        "clubs",
        "social",
        "happiness",
        "safety",
      ];
      for (const key of catKeys) {
        const val = record[key] ?? record[key.replace(/_/g, "")];
        if (val != null) {
          const f = safeFloat(val);
          if (f != null) {
            if (!categoryRatings) categoryRatings = {};
            categoryRatings[key] = f;
          }
        }
      }
    }

    let overall = safeFloat(
      record.overall ?? record.overallQuality ?? record.quality
    );
    if (overall == null && categoryRatings) {
      const vals = Object.values(categoryRatings);
      overall = vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    return {
      date: ratingDate,
      comment: String(record.comment ?? ""),
      overall,
      category_ratings: categoryRatings,
      thumbs_up: safeInt(
        record.thumbsUpTotal ?? record.thumbsUp ?? record.thumbs_up
      ),
      thumbs_down: safeInt(
        record.thumbsDownTotal ?? record.thumbsDown ?? record.thumbs_down
      ),
    };
  }
}
