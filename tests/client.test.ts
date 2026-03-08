import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RMPClient } from "../src/client.js";
import { createConfig } from "../src/config.js";
import { ParsingError } from "../src/errors.js";

function htmlWithStore(store: Record<string, unknown>): string {
  return `<html><script>window.__RELAY_STORE__ = ${JSON.stringify(store)};</script></html>`;
}

function makeProfessorStore(
  professorId: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const profNode = {
    __typename: "Professor",
    id: professorId,
    legacyId: professorId,
    name: "Test Professor",
    overallRating: 4.5,
    numRatings: 10,
    ...overrides,
  };
  return { [`node:${professorId}`]: profNode };
}

function addSchoolToStore(
  store: Record<string, any>,
  profKey: string,
  schoolId = "s1"
): void {
  store["node:s1"] = {
    __typename: "School",
    id: schoolId,
    name: "Test University",
    location: "City, ST, USA",
  };
  store[profKey].school = { __ref: "node:s1" };
}

function addRatingsToStore(
  store: Record<string, any>,
  profKey: string,
  comments: string[]
): void {
  const edges: unknown[] = [];
  for (let i = 0; i < comments.length; i++) {
    const rid = `node:r${i}`;
    store[rid] = {
      __typename: "Rating",
      id: rid,
      comment: comments[i],
      date: "2024-01-15",
      quality: 5.0,
      difficulty: 2.0,
      course: "MATH 101",
    };
    edges.push({ node: { __ref: rid } });
  }
  store["conn:ratings"] = { edges };
  store[profKey].ratings = { __ref: "conn:ratings" };
}

function mockFetchResponse(
  body: string,
  status = 200
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(JSON.parse(body)),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RMPClient.getProfessor", () => {
  it("returns professor from relay store", async () => {
    const config = createConfig({
      professors_page_url: "https://www.ratemyprofessors.com/professor/",
      rate_limit_per_minute: 1000,
    });
    const store = makeProfessorStore("abc123", {
      name: "Jane Doe",
      department: "Math",
    });
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(htmlWithStore(store))
    );
    const client = new RMPClient(config);
    try {
      const prof = await client.getProfessor("abc123");
      expect(prof.id).toBe("abc123");
      expect(prof.name).toBe("Jane Doe");
      expect(prof.department).toBe("Math");
      expect(prof.overall_rating).toBe(4.5);
      expect(prof.num_ratings).toBe(10);
    } finally {
      await client.close();
    }
  });

  it("resolves school ref", async () => {
    const config = createConfig({
      professors_page_url: "https://www.ratemyprofessors.com/professor/",
      rate_limit_per_minute: 1000,
    });
    const store = makeProfessorStore("p1");
    addSchoolToStore(store, "node:p1");
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(htmlWithStore(store))
    );
    const client = new RMPClient(config);
    try {
      const prof = await client.getProfessor("p1");
      expect(prof.school).not.toBeNull();
      expect(prof.school!.name).toBe("Test University");
      expect(prof.school!.location).toBe("City, ST, USA");
    } finally {
      await client.close();
    }
  });

  it("throws ParsingError when professor not in store", async () => {
    const config = createConfig({
      professors_page_url: "https://www.ratemyprofessors.com/professor/",
      rate_limit_per_minute: 1000,
    });
    const store = { "client:root": { __id: "client:root" } };
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(htmlWithStore(store))
    );
    const client = new RMPClient(config);
    try {
      await expect(client.getProfessor("missing")).rejects.toThrow(
        ParsingError
      );
    } finally {
      await client.close();
    }
  });

  it("throws ParsingError when store missing in HTML", async () => {
    const config = createConfig({
      professors_page_url: "https://www.ratemyprofessors.com/professor/",
      rate_limit_per_minute: 1000,
    });
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse("<html><body>No store here</body></html>")
    );
    const client = new RMPClient(config);
    try {
      await expect(client.getProfessor("x")).rejects.toThrow(ParsingError);
    } finally {
      await client.close();
    }
  });
});

describe("RMPClient.getProfessorRatingsPage", () => {
  it("returns ratings from store", async () => {
    const config = createConfig({
      professors_page_url: "https://www.ratemyprofessors.com/professor/",
      rate_limit_per_minute: 1000,
    });
    const store = makeProfessorStore("p1", { name: "Dr. Smith" });
    addRatingsToStore(store, "node:p1", ["Great!", "Okay.", "Loved it"]);
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(htmlWithStore(store))
    );
    const client = new RMPClient(config);
    try {
      const page = await client.getProfessorRatingsPage("p1", {
        page_size: 10,
      });
      expect(page.professor.name).toBe("Dr. Smith");
      expect(page.ratings).toHaveLength(3);
      expect(page.ratings[0].comment).toBe("Great!");
      expect(page.ratings[1].comment).toBe("Okay.");
      expect(page.ratings[2].comment).toBe("Loved it");
      expect(page.ratings[0].course_raw).toBe("MATH 101");
    } finally {
      await client.close();
    }
  });

  it("pagination in memory", async () => {
    const config = createConfig({
      professors_page_url: "https://www.ratemyprofessors.com/professor/",
      rate_limit_per_minute: 1000,
    });
    const store = makeProfessorStore("p1");
    addRatingsToStore(store, "node:p1", ["A", "B", "C", "D", "E"]);
    const html = htmlWithStore(store);
    fetchMock.mockResolvedValue(mockFetchResponse(html));
    const client = new RMPClient(config);
    try {
      const page1 = await client.getProfessorRatingsPage("p1", {
        page_size: 2,
      });
      const page2 = await client.getProfessorRatingsPage("p1", {
        cursor: page1.next_cursor,
        page_size: 2,
      });
      expect(page1.ratings).toHaveLength(2);
      expect(page1.ratings[0].comment).toBe("A");
      expect(page1.ratings[1].comment).toBe("B");
      expect(page1.has_next_page).toBe(true);
      expect(page2.ratings).toHaveLength(2);
      expect(page2.ratings[0].comment).toBe("C");
      expect(page2.ratings[1].comment).toBe("D");
    } finally {
      await client.close();
    }
  });
});

describe("RMPClient.searchSchools", () => {
  it("returns schools from search page", async () => {
    const store = {
      "client:root": {
        __id: "client:root",
        newSearch: { __ref: "client:root:newSearch" },
      },
      "client:root:newSearch": {
        __id: "client:root:newSearch",
        'schools(after:"",first:5,query:{"text":"queens"})': {
          __ref: "conn:schools",
        },
      },
      "conn:schools": {
        __typename: "SchoolSearchConnectionConnection",
        resultCount: 8,
        edges: { __refs: ["edge:0", "edge:1"] },
        pageInfo: { __ref: "conn:pageInfo" },
      },
      "conn:pageInfo": {
        hasNextPage: true,
        endCursor: "YXJyYXljb25uZWN0aW9uOjQ=",
      },
      "edge:0": { node: { __ref: "S1" } },
      "edge:1": { node: { __ref: "S2" } },
      S1: {
        __typename: "School",
        legacyId: 231,
        name: "CUNY Queens College",
        city: "Queens",
        state: "NY",
        numRatings: 551,
        avgRatingRounded: 3.3,
        id: "S1",
      },
      S2: {
        __typename: "School",
        legacyId: 842,
        name: "St. John's University - Jamaica/Queens",
        city: "Queens",
        state: "NY",
        numRatings: 425,
        avgRatingRounded: 3.5,
        id: "S2",
      },
    };
    const config = createConfig({
      search_schools_page_url:
        "https://www.ratemyprofessors.com/search/schools/",
      rate_limit_per_minute: 1000,
    });
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(htmlWithStore(store))
    );
    const client = new RMPClient(config);
    try {
      const result = await client.searchSchools("queens");
      expect(result.schools).toHaveLength(2);
      expect(result.schools[0].name).toBe("CUNY Queens College");
      expect(result.schools[0].location).toBe("Queens, NY");
      expect(result.schools[0].num_ratings).toBe(551);
      expect(result.schools[0].overall_quality).toBe(3.3);
      expect(result.schools[1].name).toBe(
        "St. John's University - Jamaica/Queens"
      );
      expect(result.total).toBe(8);
      expect(result.has_next_page).toBe(true);
      expect(result.next_cursor).toBe("YXJyYXljb25uZWN0aW9uOjQ=");
    } finally {
      await client.close();
    }
  });
});

describe("RMPClient.searchProfessors", () => {
  it("returns professors from search page", async () => {
    const store = {
      "client:root": {
        __id: "client:root",
        newSearch: { __ref: "client:root:newSearch" },
      },
      "client:root:newSearch": {
        __id: "client:root:newSearch",
        'teachers(after:"",first:5,query:{"text":"test"})': {
          __ref: "conn:teachers",
        },
      },
      "conn:teachers": {
        __typename: "TeacherSearchConnectionConnection",
        resultCount: 196,
        edges: { __refs: ["edge:0", "edge:1"] },
        pageInfo: { __ref: "conn:pageInfo" },
      },
      "conn:pageInfo": {
        hasNextPage: true,
        endCursor: "YXJyYXljb25uZWN0aW9uOjQ=",
      },
      "edge:0": { node: { __ref: "T1" } },
      "edge:1": { node: { __ref: "T2" } },
      T1: {
        __typename: "Teacher",
        legacyId: 2707318,
        firstName: "Susan",
        lastName: "Testani",
        department: "Mathematics",
        avgRating: 3.1,
        numRatings: 9,
        wouldTakeAgainPercent: 44.44,
        avgDifficulty: 3,
        school: { __ref: "S1" },
      },
      S1: {
        __typename: "School",
        id: "S1",
        name: "Montgomery County Community College (all)",
      },
      T2: {
        __typename: "Teacher",
        legacyId: 3079576,
        firstName: "Kimberly",
        lastName: "Testa Fortier",
        department: "Education",
        avgRating: 5,
        numRatings: 1,
        wouldTakeAgainPercent: 100,
        avgDifficulty: 1,
        school: { __ref: "S2" },
      },
      S2: {
        __typename: "School",
        id: "S2",
        name: "Purdue University Global",
      },
    };
    const config = createConfig({
      search_professors_page_url:
        "https://www.ratemyprofessors.com/search/professors/",
      rate_limit_per_minute: 1000,
    });
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(htmlWithStore(store))
    );
    const client = new RMPClient(config);
    try {
      const result = await client.searchProfessors("test");
      expect(result.professors).toHaveLength(2);
      expect(result.professors[0].name).toBe("Susan Testani");
      expect(result.professors[0].department).toBe("Mathematics");
      expect(result.professors[0].overall_rating).toBe(3.1);
      expect(result.professors[0].num_ratings).toBe(9);
      expect(result.professors[0].school).not.toBeNull();
      expect(result.professors[0].school!.name).toBe(
        "Montgomery County Community College (all)"
      );
      expect(result.professors[1].name).toBe("Kimberly Testa Fortier");
      expect(result.total).toBe(196);
      expect(result.has_next_page).toBe(true);
      expect(result.next_cursor).toBe("YXJyYXljb25uZWN0aW9uOjQ=");
    } finally {
      await client.close();
    }
  });
});

describe("RMPClient.getCompareSchools", () => {
  it("returns both schools from compare page", async () => {
    const store = {
      S1466: {
        __typename: "School",
        legacyId: 1466,
        name: "Queen's University at Kingston",
        location: "Kingston, ON",
        numRatings: 460,
        avgRatingRounded: 4,
        summary: { __ref: "sum1466" },
      },
      sum1466: {
        __typename: "SchoolSummary",
        schoolReputation: 4.42,
        schoolSafety: 4.2,
        schoolSatisfaction: 4.19,
        campusCondition: 4.17,
        socialActivities: 4.14,
        campusLocation: 4.03,
        clubAndEventActivities: 4.01,
        careerOpportunities: 4.0,
        internetSpeed: 3.72,
        foodQuality: 3.27,
      },
      S1491: {
        __typename: "School",
        legacyId: 1491,
        name: "Western University",
        location: "London, ON",
        numRatings: 889,
        avgRatingRounded: 3.9,
        summary: { __ref: "sum1491" },
      },
      sum1491: {
        __typename: "SchoolSummary",
        schoolReputation: 4.05,
        schoolSafety: 4.11,
        schoolSatisfaction: 4.07,
        campusCondition: 4.14,
        socialActivities: 4.14,
        campusLocation: 3.79,
        clubAndEventActivities: 4.05,
        careerOpportunities: 3.75,
        internetSpeed: 3.48,
        foodQuality: 3.44,
      },
    };
    const config = createConfig({
      compare_schools_page_url:
        "https://www.ratemyprofessors.com/compare/schools/",
      rate_limit_per_minute: 1000,
    });
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(htmlWithStore(store))
    );
    const client = new RMPClient(config);
    try {
      const result = await client.getCompareSchools("1466", "1491");
      expect(result.school_1.name).toBe("Queen's University at Kingston");
      expect(result.school_1.num_ratings).toBe(460);
      expect(result.school_1.overall_quality).toBe(4);
      expect(result.school_1.reputation).toBe(4.42);
      expect(result.school_2.name).toBe("Western University");
      expect(result.school_2.num_ratings).toBe(889);
      expect(result.school_2.overall_quality).toBe(3.9);
      expect(result.school_2.reputation).toBe(4.05);
    } finally {
      await client.close();
    }
  });
});
