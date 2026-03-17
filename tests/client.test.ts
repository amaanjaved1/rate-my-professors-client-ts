import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RMPClient } from "../src/client.js";
import { createConfig } from "../src/config.js";
import { ParsingError } from "../src/errors.js";

function gqlResponse(data: Record<string, unknown>): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: () => Promise.resolve(JSON.stringify({ data })),
    json: () => Promise.resolve({ data }),
  } as unknown as Response;
}

function emptyResponse(): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: () => Promise.resolve(JSON.stringify({ data: {} })),
    json: () => Promise.resolve({ data: {} }),
  } as unknown as Response;
}

const config = () => createConfig({ rate_limit_per_minute: 10000 });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// searchSchools
// ---------------------------------------------------------------------------

describe("RMPClient.searchSchools", () => {
  it("returns schools from GraphQL response", async () => {
    fetchMock.mockResolvedValueOnce(
      gqlResponse({
        search: {
          schools: {
            edges: [
              {
                cursor: "YXJyYXljb25uZWN0aW9uOjA=",
                node: {
                  id: "U2Nob29sLTIzMQ==",
                  legacyId: 231,
                  name: "CUNY Queens College",
                  city: "Queens",
                  state: "NY",
                  numRatings: 552,
                  avgRating: 0,
                  avgRatingRounded: 3.3,
                },
              },
              {
                cursor: "YXJyYXljb25uZWN0aW9uOjE=",
                node: {
                  id: "U2Nob29sLTE0NjY=",
                  legacyId: 1466,
                  name: "Queen's University at Kingston",
                  city: "Kingston",
                  state: "ON",
                  numRatings: 460,
                  avgRating: 0,
                  avgRatingRounded: 4,
                },
              },
            ],
            pageInfo: {
              hasNextPage: true,
              endCursor: "YXJyYXljb25uZWN0aW9uOjE=",
            },
            resultCount: 19,
          },
        },
      })
    );
    const client = new RMPClient(config());
    try {
      const result = await client.searchSchools("queen");
      expect(result.schools).toHaveLength(2);
      expect(result.schools[0].id).toBe("231");
      expect(result.schools[0].name).toBe("CUNY Queens College");
      expect(result.schools[0].location).toBe("Queens, NY");
      expect(result.schools[0].num_ratings).toBe(552);
      expect(result.schools[0].overall_quality).toBe(3.3);
      expect(result.schools[1].id).toBe("1466");
      expect(result.schools[1].name).toBe("Queen's University at Kingston");
      expect(result.total).toBe(19);
      expect(result.has_next_page).toBe(true);
      expect(result.next_cursor).toBe("YXJyYXljb25uZWN0aW9uOjE=");
    } finally {
      await client.close();
    }
  });

  it("returns empty result when no data", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse());
    const client = new RMPClient(config());
    try {
      const result = await client.searchSchools("nonexistent");
      expect(result.schools).toHaveLength(0);
      expect(result.has_next_page).toBe(false);
    } finally {
      await client.close();
    }
  });

  it("sends correct operationName and variables", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse());
    const client = new RMPClient(config());
    try {
      await client.searchSchools("test", { page_size: 10, cursor: "abc" });
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.operationName).toBe("SchoolSearchResultsPageQuery");
      expect(body.variables.query).toEqual({ text: "test" });
      expect(body.variables.count).toBe(10);
      expect(body.variables.cursor).toBe("abc");
    } finally {
      await client.close();
    }
  });
});

// ---------------------------------------------------------------------------
// searchProfessors
// ---------------------------------------------------------------------------

describe("RMPClient.searchProfessors", () => {
  it("returns professors from GraphQL response", async () => {
    fetchMock.mockResolvedValueOnce(
      gqlResponse({
        search: {
          teachers: {
            edges: [
              {
                cursor: "YXJyYXljb25uZWN0aW9uOjA=",
                node: {
                  id: "VGVhY2hlci0xOTI3Nzky",
                  legacyId: 1927792,
                  firstName: "Selim",
                  lastName: "Tuncel",
                  avgRating: 2.9,
                  numRatings: 35,
                  wouldTakeAgainPercent: 41.9355,
                  avgDifficulty: 4.3,
                  department: "Mathematics",
                  school: {
                    id: "U2Nob29sLTE1MzA=",
                    legacyId: 1530,
                    name: "University of Washington",
                    city: "Seattle",
                    state: "WA",
                  },
                },
              },
              {
                cursor: "YXJyYXljb25uZWN0aW9uOjE=",
                node: {
                  id: "VGVhY2hlci0zMzY3OTQ=",
                  legacyId: 336794,
                  firstName: "Selim",
                  lastName: "Kuru",
                  avgRating: 3.6,
                  numRatings: 25,
                  wouldTakeAgainPercent: 60,
                  avgDifficulty: 2.5,
                  department: "Languages",
                  school: {
                    id: "U2Nob29sLTE1MzA=",
                    legacyId: 1530,
                    name: "University of Washington",
                    city: "Seattle",
                    state: "WA",
                  },
                },
              },
            ],
            pageInfo: {
              hasNextPage: true,
              endCursor: "YXJyYXljb25uZWN0aW9uOjE=",
            },
            resultCount: 89,
          },
        },
      })
    );
    const client = new RMPClient(config());
    try {
      const result = await client.searchProfessors("selim");
      expect(result.professors).toHaveLength(2);
      expect(result.professors[0].id).toBe("1927792");
      expect(result.professors[0].name).toBe("Selim Tuncel");
      expect(result.professors[0].department).toBe("Mathematics");
      expect(result.professors[0].overall_rating).toBe(2.9);
      expect(result.professors[0].num_ratings).toBe(35);
      expect(result.professors[0].percent_take_again).toBeCloseTo(41.94, 1);
      expect(result.professors[0].level_of_difficulty).toBe(4.3);
      expect(result.professors[0].school).not.toBeNull();
      expect(result.professors[0].school!.name).toBe("University of Washington");
      expect(result.professors[0].school!.location).toBe("Seattle, WA");
      expect(result.professors[1].name).toBe("Selim Kuru");
      expect(result.total).toBe(89);
      expect(result.has_next_page).toBe(true);
      expect(result.next_cursor).toBe("YXJyYXljb25uZWN0aW9uOjE=");
    } finally {
      await client.close();
    }
  });

  it("passes school_id as schoolID variable", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse());
    const client = new RMPClient(config());
    try {
      await client.searchProfessors("test", { school_id: "1530" });
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.variables.query.schoolID).toBe("1530");
    } finally {
      await client.close();
    }
  });

  it("returns empty result when no data", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse());
    const client = new RMPClient(config());
    try {
      const result = await client.searchProfessors("zzzzz");
      expect(result.professors).toHaveLength(0);
      expect(result.has_next_page).toBe(false);
    } finally {
      await client.close();
    }
  });
});

// ---------------------------------------------------------------------------
// getProfessor
// ---------------------------------------------------------------------------

describe("RMPClient.getProfessor", () => {
  it("returns professor from GetTeacherQuery", async () => {
    fetchMock.mockResolvedValueOnce(
      gqlResponse({
        node: {
          id: "VGVhY2hlci0yODIzMDc2",
          legacyId: 2823076,
          firstName: "Jane",
          lastName: "Doe",
          department: "Computer Science",
          avgRating: 4.5,
          avgDifficulty: 2.1,
          numRatings: 42,
          wouldTakeAgainPercent: 95.5,
          school: {
            id: "U2Nob29sLTEyMw==",
            legacyId: 123,
            name: "MIT",
            city: "Cambridge",
            state: "MA",
          },
        },
      })
    );
    const client = new RMPClient(config());
    try {
      const prof = await client.getProfessor("2823076");
      expect(prof.id).toBe("2823076");
      expect(prof.name).toBe("Jane Doe");
      expect(prof.department).toBe("Computer Science");
      expect(prof.overall_rating).toBe(4.5);
      expect(prof.level_of_difficulty).toBe(2.1);
      expect(prof.num_ratings).toBe(42);
      expect(prof.percent_take_again).toBe(95.5);
      expect(prof.school).not.toBeNull();
      expect(prof.school!.name).toBe("MIT");
      expect(prof.school!.location).toBe("Cambridge, MA");
    } finally {
      await client.close();
    }
  });

  it("sends base64-encoded teacher node id", async () => {
    fetchMock.mockResolvedValueOnce(
      gqlResponse({ node: { legacyId: 123, lastName: "X" } })
    );
    const client = new RMPClient(config());
    try {
      await client.getProfessor("123");
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.variables.id).toBe(btoa("Teacher-123"));
    } finally {
      await client.close();
    }
  });

  it("throws ParsingError when node is null", async () => {
    fetchMock.mockResolvedValueOnce(gqlResponse({ node: null }));
    const client = new RMPClient(config());
    try {
      await expect(client.getProfessor("missing")).rejects.toThrow(ParsingError);
    } finally {
      await client.close();
    }
  });
});

// ---------------------------------------------------------------------------
// getSchool
// ---------------------------------------------------------------------------

describe("RMPClient.getSchool", () => {
  it("returns school with summary ratings", async () => {
    fetchMock.mockResolvedValueOnce(
      gqlResponse({
        node: {
          id: "U2Nob29sLTE0NjY=",
          legacyId: 1466,
          name: "Queen's University at Kingston",
          city: "Kingston",
          state: "ON",
          country: "Canada",
          numRatings: 460,
          avgRatingRounded: 4,
          summary: {
            campusCondition: 4.17,
            campusLocation: 4.03,
            careerOpportunities: 4.0,
            clubAndEventActivities: 4.01,
            foodQuality: 3.27,
            internetSpeed: 3.72,
            schoolReputation: 4.42,
            schoolSafety: 4.2,
            schoolSatisfaction: 4.19,
            socialActivities: 4.14,
          },
        },
      })
    );
    const client = new RMPClient(config());
    try {
      const school = await client.getSchool("1466");
      expect(school.id).toBe("1466");
      expect(school.name).toBe("Queen's University at Kingston");
      expect(school.location).toBe("Kingston, ON, Canada");
      expect(school.overall_quality).toBe(4);
      expect(school.num_ratings).toBe(460);
      expect(school.reputation).toBe(4.42);
      expect(school.safety).toBe(4.2);
      expect(school.happiness).toBe(4.19);
      expect(school.facilities).toBe(4.17);
      expect(school.social).toBe(4.14);
      expect(school.location_rating).toBe(4.03);
      expect(school.clubs).toBe(4.01);
      expect(school.opportunities).toBe(4.0);
      expect(school.internet).toBe(3.72);
      expect(school.food).toBe(3.27);
    } finally {
      await client.close();
    }
  });

  it("throws ParsingError when node is null", async () => {
    fetchMock.mockResolvedValueOnce(gqlResponse({ node: null }));
    const client = new RMPClient(config());
    try {
      await expect(client.getSchool("999")).rejects.toThrow(ParsingError);
    } finally {
      await client.close();
    }
  });

  it("sends base64-encoded school node id", async () => {
    fetchMock.mockResolvedValueOnce(
      gqlResponse({ node: { legacyId: 1466, name: "Q" } })
    );
    const client = new RMPClient(config());
    try {
      await client.getSchool("1466");
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.variables.id).toBe(btoa("School-1466"));
    } finally {
      await client.close();
    }
  });
});

// ---------------------------------------------------------------------------
// getCompareSchools
// ---------------------------------------------------------------------------

describe("RMPClient.getCompareSchools", () => {
  it("returns both schools via parallel GraphQL calls", async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const id = body.variables.id;
      if (id === btoa("School-1466")) {
        return Promise.resolve(
          gqlResponse({
            node: {
              legacyId: 1466,
              name: "Queen's University",
              city: "Kingston",
              state: "ON",
              numRatings: 460,
              avgRatingRounded: 4,
            },
          })
        );
      }
      return Promise.resolve(
        gqlResponse({
          node: {
            legacyId: 1491,
            name: "Western University",
            city: "London",
            state: "ON",
            numRatings: 889,
            avgRatingRounded: 3.9,
          },
        })
      );
    });
    const client = new RMPClient(config());
    try {
      const result = await client.getCompareSchools("1466", "1491");
      expect(result.school_1.name).toBe("Queen's University");
      expect(result.school_1.num_ratings).toBe(460);
      expect(result.school_2.name).toBe("Western University");
      expect(result.school_2.num_ratings).toBe(889);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      await client.close();
    }
  });
});

// ---------------------------------------------------------------------------
// getProfessorRatingsPage
// ---------------------------------------------------------------------------

describe("RMPClient.getProfessorRatingsPage", () => {
  function ratingsPageResponse(
    comments: string[],
    hasNextPage: boolean,
    endCursor: string | null
  ): Response {
    return gqlResponse({
      node: {
        __typename: "Teacher",
        id: "VGVhY2hlci0xMjM=",
        legacyId: 123,
        lastName: "Smith",
        numRatings: 100,
        school: { legacyId: 1, name: "Uni", city: "City", state: "ST" },
        ratings: {
          edges: comments.map((c, i) => ({
            cursor: `cursor_${i}`,
            node: {
              id: `r${i}`,
              __typename: "Rating",
              comment: c,
              helpfulRating: 4,
              clarityRating: 5,
              difficultyRating: 3,
              ratingTags: "Tough grader--Get ready to read",
              date: "2025-01-15 00:00:00 +0000 UTC",
              class: "CS 101",
            },
          })),
          pageInfo: { hasNextPage, endCursor },
        },
      },
    });
  }

  it("fetches and caches all ratings on first call", async () => {
    fetchMock.mockResolvedValueOnce(
      ratingsPageResponse(["A", "B", "C"], false, null)
    );
    const client = new RMPClient(config());
    try {
      const page = await client.getProfessorRatingsPage("123", { page_size: 2 });
      expect(page.professor.id).toBe("123");
      expect(page.professor.name).toBe("Smith");
      expect(page.ratings).toHaveLength(2);
      expect(page.ratings[0].comment).toBe("A");
      expect(page.ratings[1].comment).toBe("B");
      expect(page.has_next_page).toBe(true);
      expect(page.next_cursor).toBe("2");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      await client.close();
    }
  });

  it("serves subsequent pages from cache", async () => {
    fetchMock.mockResolvedValueOnce(
      ratingsPageResponse(["A", "B", "C", "D", "E"], false, null)
    );
    const client = new RMPClient(config());
    try {
      const page1 = await client.getProfessorRatingsPage("123", { page_size: 2 });
      const page2 = await client.getProfessorRatingsPage("123", {
        cursor: page1.next_cursor,
        page_size: 2,
      });
      const page3 = await client.getProfessorRatingsPage("123", {
        cursor: page2.next_cursor,
        page_size: 2,
      });
      expect(page1.ratings.map((r) => r.comment)).toEqual(["A", "B"]);
      expect(page2.ratings.map((r) => r.comment)).toEqual(["C", "D"]);
      expect(page3.ratings.map((r) => r.comment)).toEqual(["E"]);
      expect(page3.has_next_page).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      await client.close();
    }
  });

  it("pre-fetches multiple pages when hasNextPage is true", async () => {
    fetchMock
      .mockResolvedValueOnce(ratingsPageResponse(["A", "B"], true, "cursor1"))
      .mockResolvedValueOnce(ratingsPageResponse(["C", "D"], false, null));
    const client = new RMPClient(config());
    try {
      const page = await client.getProfessorRatingsPage("123", { page_size: 10 });
      expect(page.ratings).toHaveLength(4);
      expect(page.ratings.map((r) => r.comment)).toEqual(["A", "B", "C", "D"]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      await client.close();
    }
  });

  it("parses rating tags from ratingTags string", async () => {
    fetchMock.mockResolvedValueOnce(
      ratingsPageResponse(["A"], false, null)
    );
    const client = new RMPClient(config());
    try {
      const page = await client.getProfessorRatingsPage("123", { page_size: 10 });
      expect(page.ratings[0].tags).toEqual(["Tough grader", "Get ready to read"]);
    } finally {
      await client.close();
    }
  });

  it("parses quality from clarityRating with helpfulRating fallback", async () => {
    fetchMock.mockResolvedValueOnce(
      ratingsPageResponse(["A"], false, null)
    );
    const client = new RMPClient(config());
    try {
      const page = await client.getProfessorRatingsPage("123", { page_size: 10 });
      expect(page.ratings[0].quality).toBe(5);
      expect(page.ratings[0].difficulty).toBe(3);
      expect(page.ratings[0].course_raw).toBe("CS 101");
    } finally {
      await client.close();
    }
  });

  it("repeated first-page call returns from cache", async () => {
    fetchMock.mockResolvedValueOnce(
      ratingsPageResponse(["A", "B"], false, null)
    );
    const client = new RMPClient(config());
    try {
      await client.getProfessorRatingsPage("123");
      await client.getProfessorRatingsPage("123");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      await client.close();
    }
  });
});

// ---------------------------------------------------------------------------
// getSchoolRatingsPage
// ---------------------------------------------------------------------------

describe("RMPClient.getSchoolRatingsPage", () => {
  function schoolRatingsResponse(
    count: number,
    hasNextPage: boolean,
    endCursor: string | null
  ): Response {
    const edges = Array.from({ length: count }, (_, i) => ({
      cursor: `c${i}`,
      node: {
        id: `sr${i}`,
        comment: `Review ${i}`,
        date: "2025-12-15 22:29:19 +0000 UTC",
        reputationRating: 5,
        locationRating: 4,
        safetyRating: 5,
        socialRating: 4,
        opportunitiesRating: 5,
        happinessRating: 5,
        facilitiesRating: 5,
        internetRating: 4,
        foodRating: 3,
        clubsRating: 5,
        thumbsUpTotal: 2,
        thumbsDownTotal: 1,
      },
    }));
    return gqlResponse({
      node: {
        id: "U2Nob29sLTE0NjY=",
        name: "Queen's University",
        city: "Kingston",
        state: "ON",
        country: "Canada",
        ratings: { edges, pageInfo: { hasNextPage, endCursor } },
      },
    });
  }

  it("fetches and caches school ratings", async () => {
    fetchMock.mockResolvedValueOnce(schoolRatingsResponse(3, false, null));
    const client = new RMPClient(config());
    try {
      const page = await client.getSchoolRatingsPage("1466", { page_size: 2 });
      expect(page.school.name).toBe("Queen's University");
      expect(page.ratings).toHaveLength(2);
      expect(page.has_next_page).toBe(true);
      expect(page.next_cursor).toBe("2");
    } finally {
      await client.close();
    }
  });

  it("parses category ratings correctly", async () => {
    fetchMock.mockResolvedValueOnce(schoolRatingsResponse(1, false, null));
    const client = new RMPClient(config());
    try {
      const page = await client.getSchoolRatingsPage("1466", { page_size: 10 });
      const r = page.ratings[0];
      expect(r.category_ratings).not.toBeNull();
      expect(r.category_ratings!.reputation).toBe(5);
      expect(r.category_ratings!.location).toBe(4);
      expect(r.category_ratings!.food).toBe(3);
      expect(r.thumbs_up).toBe(2);
      expect(r.thumbs_down).toBe(1);
      expect(r.overall).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  it("serves subsequent pages from cache", async () => {
    fetchMock.mockResolvedValueOnce(schoolRatingsResponse(5, false, null));
    const client = new RMPClient(config());
    try {
      const p1 = await client.getSchoolRatingsPage("1466", { page_size: 2 });
      const p2 = await client.getSchoolRatingsPage("1466", {
        cursor: p1.next_cursor,
        page_size: 2,
      });
      expect(p1.ratings).toHaveLength(2);
      expect(p2.ratings).toHaveLength(2);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      await client.close();
    }
  });

  it("pre-fetches multiple pages", async () => {
    fetchMock
      .mockResolvedValueOnce(schoolRatingsResponse(2, true, "c1"))
      .mockResolvedValueOnce(schoolRatingsResponse(2, false, null));
    const client = new RMPClient(config());
    try {
      const page = await client.getSchoolRatingsPage("1466", { page_size: 10 });
      expect(page.ratings).toHaveLength(4);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      await client.close();
    }
  });
});

// ---------------------------------------------------------------------------
// iterProfessorRatings
// ---------------------------------------------------------------------------

describe("RMPClient.iterProfessorRatings", () => {
  it("yields all ratings across pages", async () => {
    fetchMock.mockResolvedValueOnce(
      gqlResponse({
        node: {
          legacyId: 1,
          lastName: "X",
          numRatings: 3,
          ratings: {
            edges: [
              { cursor: "c0", node: { comment: "A", date: "2025-03-01", clarityRating: 5, difficultyRating: 2, class: "CS" } },
              { cursor: "c1", node: { comment: "B", date: "2025-02-01", clarityRating: 4, difficultyRating: 3, class: "CS" } },
              { cursor: "c2", node: { comment: "C", date: "2025-01-01", clarityRating: 3, difficultyRating: 4, class: "CS" } },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      })
    );
    const client = new RMPClient(config());
    try {
      const ratings: string[] = [];
      for await (const r of client.iterProfessorRatings("1", { page_size: 10 })) {
        ratings.push(r.comment);
      }
      expect(ratings).toEqual(["A", "B", "C"]);
    } finally {
      await client.close();
    }
  });

  it("stops at 'since' date", async () => {
    fetchMock.mockResolvedValueOnce(
      gqlResponse({
        node: {
          legacyId: 1,
          lastName: "X",
          numRatings: 3,
          ratings: {
            edges: [
              { cursor: "c0", node: { comment: "New", date: "2025-06-01", clarityRating: 5, difficultyRating: 2, class: "CS" } },
              { cursor: "c1", node: { comment: "Old", date: "2024-01-01", clarityRating: 4, difficultyRating: 3, class: "CS" } },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      })
    );
    const client = new RMPClient(config());
    try {
      const ratings: string[] = [];
      const since = new Date("2025-01-01T00:00:00Z");
      for await (const r of client.iterProfessorRatings("1", { since })) {
        ratings.push(r.comment);
      }
      expect(ratings).toEqual(["New"]);
    } finally {
      await client.close();
    }
  });
});

// ---------------------------------------------------------------------------
// iterSchoolRatings
// ---------------------------------------------------------------------------

describe("RMPClient.iterSchoolRatings", () => {
  it("yields all school ratings", async () => {
    fetchMock.mockResolvedValueOnce(
      gqlResponse({
        node: {
          name: "Uni",
          city: "C",
          state: "S",
          ratings: {
            edges: [
              { cursor: "c0", node: { comment: "Good", date: "2025-12-01", reputationRating: 5, thumbsUpTotal: 1, thumbsDownTotal: 0 } },
              { cursor: "c1", node: { comment: "Fine", date: "2025-11-01", reputationRating: 4, thumbsUpTotal: 0, thumbsDownTotal: 0 } },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      })
    );
    const client = new RMPClient(config());
    try {
      const comments: string[] = [];
      for await (const r of client.iterSchoolRatings("1466")) {
        comments.push(r.comment);
      }
      expect(comments).toEqual(["Good", "Fine"]);
    } finally {
      await client.close();
    }
  });
});

// ---------------------------------------------------------------------------
// listProfessorsForSchool
// ---------------------------------------------------------------------------

describe("RMPClient.listProfessorsForSchool", () => {
  it("passes school_id to searchProfessors", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse());
    const client = new RMPClient(config());
    try {
      await client.listProfessorsForSchool(1530);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.variables.query.schoolID).toBe("1530");
      expect(body.variables.query.text).toBe("");
    } finally {
      await client.close();
    }
  });
});

// ---------------------------------------------------------------------------
// rawQuery
// ---------------------------------------------------------------------------

describe("RMPClient.rawQuery", () => {
  it("forwards payload to postJson", async () => {
    fetchMock.mockResolvedValueOnce(
      gqlResponse({ custom: "result" })
    );
    const client = new RMPClient(config());
    try {
      const result = await client.rawQuery({ query: "{ viewer { id } }" });
      expect((result.data as Record<string, unknown>).custom).toBe("result");
    } finally {
      await client.close();
    }
  });
});

// ---------------------------------------------------------------------------
// close
// ---------------------------------------------------------------------------

describe("RMPClient.close", () => {
  it("clears caches and is safe to call multiple times", async () => {
    const client = new RMPClient(config());
    await client.close();
    await client.close();
  });
});
