/**
 * Integration tests for RMPClient against the live RateMyProfessors GraphQL API.
 *
 * These tests make real HTTP requests. Assertions are kept flexible since
 * live data (num_ratings, etc.) changes over time.
 */

import { describe, it, expect, afterAll } from "vitest";
import { RMPClient } from "../src/client.js";
import { createConfig } from "../src/config.js";
import { ParsingError, RMPAPIError } from "../src/errors.js";

const SCHOOL_QUEENS = "1466";
const SCHOOL_WESTERN = "1491";
const SCHOOL_UW = "1530";
const PROFESSOR_ID = "2823076";

const client = new RMPClient(createConfig({ rate_limit_per_minute: 30 }));

afterAll(async () => {
  await client.close();
});

// ---------------------------------------------------------------------------
// searchSchools
// ---------------------------------------------------------------------------

describe("RMPClient.searchSchools", () => {
  it("returns results for a valid query", async () => {
    const result = await client.searchSchools("queens");
    expect(result.schools.length).toBeGreaterThan(0);
    const school = result.schools[0];
    expect(school.id).toBeTruthy();
    expect(school.name).toBeTruthy();
    expect(school.location).toBeTruthy();
  });

  it("returns pagination fields", async () => {
    const result = await client.searchSchools("university", { page_size: 2 });
    expect(result.page_size).toBeLessThanOrEqual(2);
    expect(typeof result.has_next_page).toBe("boolean");
    if (result.has_next_page) {
      expect(result.next_cursor).toBeTruthy();
    }
  });

  it("paginates across multiple pages using cursor", async () => {
    const p1 = await client.searchSchools("university", { page_size: 2 });
    expect(p1.schools.length).toBeGreaterThan(0);
    expect(p1.has_next_page).toBe(true);
    expect(p1.next_cursor).toBeTruthy();

    const p2 = await client.searchSchools("university", {
      page_size: 2,
      cursor: p1.next_cursor,
    });
    expect(p2.schools.length).toBeGreaterThan(0);

    const p1Ids = new Set(p1.schools.map((s) => s.id));
    const p2Ids = new Set(p2.schools.map((s) => s.id));
    for (const id of p2Ids) {
      expect(p1Ids.has(id)).toBe(false);
    }
  });

  it("returns empty result for nonsense query", async () => {
    const result = await client.searchSchools("zzzxxx999qqq");
    expect(result.schools).toHaveLength(0);
    expect(result.has_next_page).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// searchProfessors
// ---------------------------------------------------------------------------

describe("RMPClient.searchProfessors", () => {
  it("returns results for a valid query", async () => {
    const result = await client.searchProfessors("smith");
    expect(result.professors.length).toBeGreaterThan(0);
    const prof = result.professors[0];
    expect(prof.id).toBeTruthy();
    expect(prof.name).toBeTruthy();
  });

  it("filters by school_id", async () => {
    const result = await client.searchProfessors("smith", {
      school_id: SCHOOL_UW,
    });
    expect(result.professors.length).toBeGreaterThan(0);
    for (const prof of result.professors) {
      if (prof.school) {
        expect(prof.school.id).toBe(SCHOOL_UW);
      }
    }
  });

  it("paginates across multiple pages using cursor", async () => {
    const p1 = await client.searchProfessors("smith", { page_size: 2 });
    expect(p1.professors.length).toBeGreaterThan(0);
    expect(p1.has_next_page).toBe(true);
    expect(p1.next_cursor).toBeTruthy();

    const p2 = await client.searchProfessors("smith", {
      page_size: 2,
      cursor: p1.next_cursor,
    });
    expect(p2.professors.length).toBeGreaterThan(0);

    const p1Ids = new Set(p1.professors.map((p) => p.id));
    const p2Ids = new Set(p2.professors.map((p) => p.id));
    for (const id of p2Ids) {
      expect(p1Ids.has(id)).toBe(false);
    }
  });

  it("returns empty result for nonsense query", async () => {
    const result = await client.searchProfessors("zzzxxx999qqq");
    expect(result.professors).toHaveLength(0);
    expect(result.has_next_page).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getProfessor
// ---------------------------------------------------------------------------

describe("RMPClient.getProfessor", () => {
  it("returns professor data", async () => {
    const prof = await client.getProfessor(PROFESSOR_ID);
    expect(prof.id).toBe(PROFESSOR_ID);
    expect(prof.name.length).toBeGreaterThan(0);
    expect(prof.department).toBeTruthy();
    expect(prof.overall_rating).toBeGreaterThanOrEqual(0);
    expect(prof.num_ratings).toBeGreaterThan(0);
    expect(prof.school).not.toBeNull();
    expect(prof.school!.name).toBeTruthy();
  });

  it("has correct numeric field types", async () => {
    const prof = await client.getProfessor(PROFESSOR_ID);
    expect(typeof prof.overall_rating).toBe("number");
    expect(typeof prof.level_of_difficulty).toBe("number");
    expect(typeof prof.num_ratings).toBe("number");
  });

  it("throws an error for invalid id", async () => {
    await expect(client.getProfessor("999999999")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getSchool
// ---------------------------------------------------------------------------

describe("RMPClient.getSchool", () => {
  it("returns school with summary category ratings", async () => {
    const school = await client.getSchool(SCHOOL_QUEENS);
    expect(school.id).toBe(SCHOOL_QUEENS);
    expect(school.name).toContain("Queen");
    expect(school.location).toBeTruthy();
    expect(school.overall_quality).not.toBeNull();
    expect(school.num_ratings).toBeGreaterThan(0);
  });

  it("has category ratings populated", async () => {
    const school = await client.getSchool(SCHOOL_QUEENS);
    expect(school.reputation).not.toBeNull();
    expect(school.safety).not.toBeNull();
    expect(school.happiness).not.toBeNull();
    expect(school.facilities).not.toBeNull();
    expect(school.social).not.toBeNull();
    expect(school.food).not.toBeNull();
    expect(school.internet).not.toBeNull();
    expect(school.clubs).not.toBeNull();
    expect(school.opportunities).not.toBeNull();
    expect(school.location_rating).not.toBeNull();
  });

  it("throws an error for invalid id", async () => {
    await expect(client.getSchool("999999999")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getCompareSchools
// ---------------------------------------------------------------------------

describe("RMPClient.getCompareSchools", () => {
  it("returns both schools", async () => {
    const result = await client.getCompareSchools(SCHOOL_QUEENS, SCHOOL_WESTERN);
    expect(result.school_1.id).toBe(SCHOOL_QUEENS);
    expect(result.school_2.id).toBe(SCHOOL_WESTERN);
    expect(result.school_1.name).not.toBe(result.school_2.name);
    expect(result.school_1.num_ratings).toBeGreaterThan(0);
    expect(result.school_2.num_ratings).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getProfessorRatingsPage (cached pagination)
// ---------------------------------------------------------------------------

describe("RMPClient.getProfessorRatingsPage", () => {
  it("fetches first page of ratings", async () => {
    const page = await client.getProfessorRatingsPage(PROFESSOR_ID, {
      page_size: 5,
    });
    expect(page.professor.id).toBe(PROFESSOR_ID);
    expect(page.professor.name.length).toBeGreaterThan(0);
    expect(page.ratings.length).toBeGreaterThan(0);
    expect(page.ratings.length).toBeLessThanOrEqual(5);
    for (const r of page.ratings) {
      expect(r.date).toBeInstanceOf(Date);
      expect(typeof r.comment).toBe("string");
    }
  });

  it("loads more from cache", async () => {
    const p1 = await client.getProfessorRatingsPage(PROFESSOR_ID, {
      page_size: 3,
    });
    expect(p1.has_next_page).toBe(true);
    expect(p1.next_cursor).toBeTruthy();

    const p2 = await client.getProfessorRatingsPage(PROFESSOR_ID, {
      cursor: p1.next_cursor,
      page_size: 3,
    });
    expect(p2.ratings.length).toBeGreaterThan(0);

    const p1Comments = new Set(p1.ratings.map((r) => r.comment));
    const p2Comments = new Set(p2.ratings.map((r) => r.comment));
    for (const c of p2Comments) {
      expect(p1Comments.has(c)).toBe(false);
    }
  });

  it("has rating fields populated", async () => {
    const page = await client.getProfessorRatingsPage(PROFESSOR_ID, {
      page_size: 5,
    });
    for (const r of page.ratings) {
      expect(r.date).toBeInstanceOf(Date);
      expect(r.quality === null || typeof r.quality === "number").toBe(true);
      expect(r.difficulty === null || typeof r.difficulty === "number").toBe(true);
      expect(Array.isArray(r.tags)).toBe(true);
    }
  });

  it("supports multiple show mores", async () => {
    const allComments: string[] = [];
    let cursor: string | null = null;
    let pagesFetched = 0;
    while (pagesFetched < 4) {
      const page = await client.getProfessorRatingsPage(PROFESSOR_ID, {
        cursor: cursor ?? undefined,
        page_size: 5,
      });
      allComments.push(...page.ratings.map((r) => r.comment));
      pagesFetched++;
      if (!page.has_next_page) break;
      cursor = page.next_cursor;
    }
    expect(allComments.length).toBeGreaterThan(5);
    expect(new Set(allComments).size).toBe(allComments.length);
  });
});

// ---------------------------------------------------------------------------
// getSchoolRatingsPage (cached pagination)
// ---------------------------------------------------------------------------

describe("RMPClient.getSchoolRatingsPage", () => {
  it("fetches first page of school ratings", async () => {
    const page = await client.getSchoolRatingsPage(SCHOOL_QUEENS, {
      page_size: 5,
    });
    expect(page.school.name).toBeTruthy();
    expect(page.ratings.length).toBeGreaterThan(0);
    expect(page.ratings.length).toBeLessThanOrEqual(5);
  });

  it("has category ratings on each review", async () => {
    const page = await client.getSchoolRatingsPage(SCHOOL_QUEENS, {
      page_size: 5,
    });
    for (const r of page.ratings) {
      expect(r.date).toBeInstanceOf(Date);
      expect(typeof r.comment).toBe("string");
      if (r.category_ratings) {
        expect(typeof r.category_ratings).toBe("object");
        expect(Object.keys(r.category_ratings).length).toBeGreaterThan(0);
      }
    }
  });

  it("loads more from cache", async () => {
    const p1 = await client.getSchoolRatingsPage(SCHOOL_QUEENS, {
      page_size: 3,
    });
    if (!p1.has_next_page) return; // school may not have enough ratings

    const p2 = await client.getSchoolRatingsPage(SCHOOL_QUEENS, {
      cursor: p1.next_cursor!,
      page_size: 3,
    });
    expect(p2.ratings.length).toBeGreaterThan(0);
  });

  it("computes overall score", async () => {
    const page = await client.getSchoolRatingsPage(SCHOOL_QUEENS, {
      page_size: 5,
    });
    for (const r of page.ratings) {
      if (r.category_ratings && Object.keys(r.category_ratings).length > 0) {
        expect(r.overall).not.toBeNull();
        expect(r.overall!).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// iterProfessorRatings
// ---------------------------------------------------------------------------

describe("RMPClient.iterProfessorRatings", () => {
  it("yields ratings", async () => {
    const ratings: { comment: string; date: Date }[] = [];
    for await (const r of client.iterProfessorRatings(PROFESSOR_ID, {
      page_size: 5,
    })) {
      ratings.push({ comment: r.comment, date: r.date });
    }
    expect(ratings.length).toBeGreaterThan(0);
    for (const r of ratings) {
      expect(r.date).toBeInstanceOf(Date);
      expect(typeof r.comment).toBe("string");
    }
  });

  it("stops at since date", async () => {
    const cutoff = new Date("2025-01-01T00:00:00Z");
    const ratings: Date[] = [];
    for await (const r of client.iterProfessorRatings(PROFESSOR_ID, {
      page_size: 10,
      since: cutoff,
    })) {
      ratings.push(r.date);
    }
    for (const d of ratings) {
      expect(d.getTime()).toBeGreaterThan(cutoff.getTime());
    }
  });

  it("collects all ratings in order", async () => {
    const all: Date[] = [];
    for await (const r of client.iterProfessorRatings(PROFESSOR_ID, {
      page_size: 20,
    })) {
      all.push(r.date);
    }
    expect(all.length).toBeGreaterThan(0);
    for (let i = 1; i < all.length; i++) {
      expect(all[i].getTime()).toBeLessThanOrEqual(all[i - 1].getTime());
    }
  });
});

// ---------------------------------------------------------------------------
// iterSchoolRatings
// ---------------------------------------------------------------------------

describe("RMPClient.iterSchoolRatings", () => {
  it("yields school ratings", async () => {
    const comments: string[] = [];
    for await (const r of client.iterSchoolRatings(SCHOOL_QUEENS, {
      page_size: 5,
    })) {
      comments.push(r.comment);
    }
    expect(comments.length).toBeGreaterThan(0);
  });

  it("stops at since date", async () => {
    const cutoff = new Date("2025-01-01T00:00:00Z");
    const dates: Date[] = [];
    for await (const r of client.iterSchoolRatings(SCHOOL_QUEENS, {
      page_size: 10,
      since: cutoff,
    })) {
      dates.push(r.date);
    }
    for (const d of dates) {
      expect(d.getTime()).toBeGreaterThan(cutoff.getTime());
    }
  });
});

// ---------------------------------------------------------------------------
// listProfessorsForSchool
// ---------------------------------------------------------------------------

describe("RMPClient.listProfessorsForSchool", () => {
  it("returns professors at a school", async () => {
    const result = await client.listProfessorsForSchool(Number(SCHOOL_UW), {
      page_size: 5,
    });
    expect(result.professors.length).toBeGreaterThan(0);
    for (const prof of result.professors) {
      expect(prof.id).toBeTruthy();
      expect(prof.name).toBeTruthy();
    }
  });

  it("paginates with cursor", async () => {
    const p1 = await client.listProfessorsForSchool(Number(SCHOOL_UW), {
      page_size: 2,
    });
    expect(p1.professors.length).toBeGreaterThan(0);
    expect(p1.has_next_page).toBe(true);

    const p2 = await client.listProfessorsForSchool(Number(SCHOOL_UW), {
      page_size: 2,
      cursor: p1.next_cursor,
    });
    expect(p2.professors.length).toBeGreaterThan(0);

    const p1Ids = new Set(p1.professors.map((p) => p.id));
    for (const p of p2.professors) {
      expect(p1Ids.has(p.id)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// iterProfessorsForSchool
// ---------------------------------------------------------------------------

describe("RMPClient.iterProfessorsForSchool", () => {
  it("yields professors across pages", async () => {
    const profs: string[] = [];
    for await (const prof of client.iterProfessorsForSchool(Number(SCHOOL_UW), {
      page_size: 5,
    })) {
      profs.push(prof.name);
      if (profs.length >= 10) break;
    }
    expect(profs.length).toBeGreaterThanOrEqual(5);
  });

  it("yields unique professors across pages", async () => {
    const ids: string[] = [];
    for await (const prof of client.iterProfessorsForSchool(Number(SCHOOL_UW), {
      page_size: 2,
    })) {
      ids.push(prof.id);
      if (ids.length >= 5) break;
    }
    expect(ids.length).toBeGreaterThanOrEqual(3);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// rawQuery
// ---------------------------------------------------------------------------

describe("RMPClient.rawQuery", () => {
  it("sends a query and gets a response", async () => {
    const nodeId = btoa(`School-${SCHOOL_QUEENS}`);
    const result = await client.rawQuery({
      operationName: "GetSchoolQuery",
      query: `query GetSchoolQuery($id: ID!) { node(id: $id) { ... on School { id legacyId name } } }`,
      variables: { id: nodeId },
    });
    const data = result.data as Record<string, unknown>;
    const node = data.node as Record<string, unknown>;
    expect(node).not.toBeNull();
    expect((node.name as string)).toContain("Queen");
  });
});

// ---------------------------------------------------------------------------
// close
// ---------------------------------------------------------------------------

describe("RMPClient.close", () => {
  it("is safe to call multiple times", async () => {
    const c = new RMPClient(createConfig());
    await c.close();
    await c.close();
  });
});
