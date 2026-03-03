/**
 * High-level client for RateMyProfessors.
 */

import type { RMPClientConfig } from "./config.js";
import { configFromEnv } from "./config.js";
import { ParsingError } from "./errors.js";
import type { HttpClient } from "./http.js";
import { HttpClient as HttpClientClass } from "./http.js";
import type {
  Professor,
  ProfessorRatingsPage,
  ProfessorSearchResult,
  Rating,
  School,
  SchoolSearchResult,
} from "./models.js";

type Mapping = Record<string, unknown>;

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
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export class RMPClient {
  private _config: RMPClientConfig;
  private _http: HttpClientClass | null = null;

  constructor(config?: RMPClientConfig | null) {
    this._config = config ?? configFromEnv();
  }

  private _getClient(): HttpClient {
    if (!this._http) {
      this._http = new HttpClientClass(this._config);
    }
    return this._http;
  }

  async close(): Promise<void> {
    if (this._http) {
      this._http.close();
      this._http = null;
    }
  }

  /** Send a raw JSON/GraphQL-style payload to the RMP backend. */
  async rawQuery(payload: Mapping): Promise<Record<string, unknown>> {
    return this._getClient().postJson("", payload as Record<string, unknown>);
  }

  /** Search schools by name. */
  async searchSchools(
    query: string,
    options: { page?: number; page_size?: number } = {}
  ): Promise<SchoolSearchResult> {
    const page = options.page ?? 1;
    const page_size = options.page_size ?? 20;
    const variables: Record<string, unknown> = { query, page, pageSize: page_size };
    const payload = {
      operationName: "SearchSchools",
      variables,
      query: "...",
    };
    const data = (await this.rawQuery(payload)) as Record<string, unknown>;
    try {
      const schoolsData = (data?.data as Record<string, unknown>)?.["schools"] as Record<string, unknown>;
      const edges = (schoolsData?.edges ?? []) as Mapping[];
      const schools: School[] = edges.map((edge) => {
        const node = (edge.node ?? {}) as Mapping;
        return {
          id: String(node.id ?? ""),
          name: String(node.name ?? ""),
          city: node.city != null ? String(node.city) : null,
          state: node.state != null ? String(node.state) : null,
          country: node.country != null ? String(node.country) : null,
        };
      });
      const pageInfo = (schoolsData?.pageInfo ?? {}) as Mapping;
      const has_next_page = Boolean(pageInfo.hasNextPage);
      const total = schoolsData?.totalCount as number | undefined;
      return {
        schools,
        total: total ?? null,
        page,
        page_size,
        has_next_page,
      };
    } catch (e) {
      throw new ParsingError(`Unexpected school search payload: ${JSON.stringify(data)}`);
    }
  }

  /** Search professors by name and optional school. */
  async searchProfessors(
    query: string,
    options: { school_id?: string | null; page?: number; page_size?: number } = {}
  ): Promise<ProfessorSearchResult> {
    const page = options.page ?? 1;
    const page_size = options.page_size ?? 20;
    const variables: Record<string, unknown> = {
      query,
      page,
      pageSize: page_size,
    };
    if (options.school_id != null) variables.schoolId = options.school_id;
    const payload = {
      operationName: "SearchProfessors",
      variables,
      query: "...",
    };
    const data = (await this.rawQuery(payload)) as Record<string, unknown>;
    try {
      const profsData = (data?.data as Record<string, unknown>)?.["professors"] as Record<string, unknown>;
      const edges = (profsData?.edges ?? []) as Mapping[];
      const professors = edges.map((edge) => this._parseProfessorEdge(edge));
      const pageInfo = (profsData?.pageInfo ?? {}) as Mapping;
      const has_next_page = Boolean(pageInfo.hasNextPage);
      const total = profsData?.totalCount as number | undefined;
      return {
        professors,
        total: total ?? null,
        page,
        page_size,
        has_next_page,
      };
    } catch (e) {
      throw new ParsingError(`Unexpected professor search payload: ${JSON.stringify(data)}`);
    }
  }

  /** List professors for a given school. */
  async listProfessorsForSchool(
    school_id: number,
    options: { query?: string | null; page?: number; page_size?: number } = {}
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
    const page_size = options.page_size ?? 20;
    let page = 1;
    while (true) {
      const result = await this.listProfessorsForSchool(school_id, {
        query: options.query,
        page,
        page_size,
      });
      if (result.professors.length === 0) break;
      for (const prof of result.professors) {
        yield prof;
      }
      if (!result.has_next_page) break;
      page++;
    }
  }

  /** Fetch detailed information about a single professor. */
  async getProfessor(professor_id: string): Promise<Professor> {
    const payload = {
      operationName: "GetProfessor",
      variables: { id: professor_id },
      query: "...",
    };
    const data = (await this.rawQuery(payload)) as Record<string, unknown>;
    try {
      const node = (data?.data as Record<string, unknown>)?.["node"] as Mapping;
      return this._parseProfessorNode(node);
    } catch (e) {
      throw new ParsingError(`Unexpected get_professor payload: ${JSON.stringify(data)}`);
    }
  }

  /** Fetch a single page of ratings for a professor. */
  async getProfessorRatingsPage(
    professor_id: string,
    options: { cursor?: string | null; page_size?: number } = {}
  ): Promise<ProfessorRatingsPage> {
    const page_size = options.page_size ?? 20;
    const variables: Record<string, unknown> = {
      id: professor_id,
      first: page_size,
      after: options.cursor ?? null,
    };
    const payload = {
      operationName: "GetProfessorRatings",
      variables,
      query: "...",
    };
    const data = (await this.rawQuery(payload)) as Record<string, unknown>;
    try {
      const node = (data?.data as Record<string, unknown>)?.["node"] as Mapping;
      const ratingsConn = (node?.ratings ?? {}) as Mapping;
      const edges = (ratingsConn.edges ?? []) as Mapping[];
      const professor = this._parseProfessorNode(node);
      const ratings: Rating[] = edges.map((edge) => {
        const n = (edge.node ?? {}) as Mapping;
        return this._parseRatingNode(n);
      });
      const pageInfo = (ratingsConn.pageInfo ?? {}) as Mapping;
      const has_next_page = Boolean(pageInfo.hasNextPage);
      const next_cursor = pageInfo.endCursor != null ? String(pageInfo.endCursor) : null;
      return {
        professor,
        ratings,
        has_next_page,
        next_cursor,
      };
    } catch (e) {
      throw new ParsingError(`Unexpected ratings payload: ${JSON.stringify(data)}`);
    }
  }

  /** Iterate ratings for a professor (async generator). */
  async *iterProfessorRatings(
    professor_id: string,
    options: { page_size?: number; since?: Date | null } = {}
  ): AsyncGenerator<Rating> {
    const page_size = options.page_size ?? 20;
    const since = options.since ?? null;
    let cursor: string | null = null;
    while (true) {
      const page = await this.getProfessorRatingsPage(professor_id, {
        cursor,
        page_size,
      });
      for (const rating of page.ratings) {
        if (since && rating.date.getTime() <= since.getTime()) return;
        yield rating;
      }
      if (!page.has_next_page || !page.next_cursor) return;
      cursor = page.next_cursor;
    }
  }

  private _parseProfessorEdge(edge: Mapping): Professor {
    const node = (edge.node ?? {}) as Mapping;
    return this._parseProfessorNode(node);
  }

  private _parseProfessorNode(node: Mapping): Professor {
    const schoolInfo = node.school;
    let school: School | null = null;
    if (schoolInfo && typeof schoolInfo === "object" && !Array.isArray(schoolInfo)) {
      const s = schoolInfo as Mapping;
      school = {
        id: String(s.id ?? ""),
        name: String(s.name ?? ""),
        city: s.city != null ? String(s.city) : null,
        state: s.state != null ? String(s.state) : null,
        country: s.country != null ? String(s.country) : null,
      };
    }
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
    };
  }

  private _parseRatingNode(node: Mapping): Rating {
    const date = parseDate(node.date);
    const tagsRaw = node.tags;
    const tags = Array.isArray(tagsRaw) ? tagsRaw.map((t) => String(t)) : [];
    return {
      date,
      comment: String(node.comment ?? ""),
      quality: safeFloat(node.quality),
      difficulty: safeFloat(node.difficulty),
      tags,
      course_raw: node.course != null ? String(node.course) : null,
    };
  }
}
