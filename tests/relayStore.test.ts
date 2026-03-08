import { describe, it, expect } from "vitest";
import {
  extractRelayStore,
  getAllRatingRecords,
  getProfessorNode,
  getProfessorRatingsConnectionPageInfo,
  getRatingsFromStore,
  getSchoolNode,
  getSchoolRatingsConnectionPageInfo,
  getSchoolRatingsFromStore,
} from "../src/relayStore.js";

function htmlWithStore(store: Record<string, unknown>): string {
  return `<html><script>window.__RELAY_STORE__ = ${JSON.stringify(store)};</script></html>`;
}

describe("extractRelayStore", () => {
  it("extracts valid store", () => {
    const store = {
      "client:root": { __id: "client:root" },
      "node:1": { __typename: "Professor", id: "1" },
    };
    const html = htmlWithStore(store);
    expect(extractRelayStore(html)).toEqual(store);
  });

  it("extracts nested JSON", () => {
    const store = { a: { b: { c: 1 } }, d: [] as unknown[] };
    const html = htmlWithStore(store);
    const result = extractRelayStore(html);
    expect((result.a as any).b.c).toBe(1);
    expect(result.d).toEqual([]);
  });

  it("throws when marker missing", () => {
    const html = "<html><script>window.OTHER = {};</script></html>";
    expect(() => extractRelayStore(html)).toThrow("__RELAY_STORE__ not found");
  });

  it("throws on invalid JSON", () => {
    const html =
      "<html><script>window.__RELAY_STORE__ = { invalid };</script></html>";
    expect(() => extractRelayStore(html)).toThrow();
  });

  it("handles strings with braces inside", () => {
    const store = { key: "value with { and }" };
    const html = htmlWithStore(store);
    const result = extractRelayStore(html);
    expect(result.key).toBe("value with { and }");
  });
});

describe("getProfessorNode", () => {
  it("finds by id", () => {
    const store = {
      "node:abc": { __typename: "Professor", id: "abc", name: "Jane" },
    };
    const node = getProfessorNode(store, "abc");
    expect(node).not.toBeNull();
    expect(node!.name).toBe("Jane");
  });

  it("finds by legacyId", () => {
    const store = {
      "node:slug123": {
        __typename: "Professor",
        legacyId: "slug123",
        name: "Bob",
      },
    };
    const node = getProfessorNode(store, "slug123");
    expect(node).not.toBeNull();
    expect(node!.name).toBe("Bob");
  });

  it("finds Teacher by legacyId (RMP style)", () => {
    const store = {
      "VGVhY2hlci0yODIzMDc2": {
        __typename: "Teacher",
        legacyId: 2823076,
        firstName: "Erin",
        lastName: "Meger",
      },
    };
    const node = getProfessorNode(store, "2823076");
    expect(node).not.toBeNull();
    expect(node!.firstName).toBe("Erin");
  });

  it("returns null when not found", () => {
    const store = { "node:1": { __typename: "School", id: "1" } };
    expect(getProfessorNode(store, "999")).toBeNull();
  });

  it("ignores non-professor records", () => {
    const store = { "node:1": { __typename: "Rating", id: "1" } };
    expect(getProfessorNode(store, "1")).toBeNull();
  });

  it("matches numeric id as string", () => {
    const store = {
      "node:42": { __typename: "Professor", id: 42, name: "Num" },
    };
    const node = getProfessorNode(store, "42");
    expect(node).not.toBeNull();
    expect(node!.name).toBe("Num");
  });
});

describe("getRatingsFromStore", () => {
  it("ratings via ref connection", () => {
    const store: Record<string, any> = {
      "node:prof": {
        __typename: "Professor",
        id: "prof",
        ratings: { __ref: "conn:prof" },
      },
      "conn:prof": {
        edges: [
          { node: { __ref: "node:r1" } },
          { node: { __ref: "node:r2" } },
        ],
      },
      "node:r1": { __typename: "Rating", id: "r1", comment: "Good" },
      "node:r2": { __typename: "Rating", id: "r2", comment: "OK" },
    };
    const ratings = getRatingsFromStore(store, store["node:prof"]);
    expect(ratings).toHaveLength(2);
    expect(ratings[0].comment).toBe("Good");
    expect(ratings[1].comment).toBe("OK");
  });

  it("ratings inline edges", () => {
    const store: Record<string, any> = {
      "node:prof": {
        __typename: "Professor",
        ratings: {
          edges: [
            { node: { __typename: "Rating", comment: "A" } },
            { node: { __typename: "ProfessorRating", comment: "B" } },
          ],
        },
      },
    };
    const ratings = getRatingsFromStore(store, store["node:prof"]);
    expect(ratings).toHaveLength(2);
    expect(ratings[0].comment).toBe("A");
    expect(ratings[1].comment).toBe("B");
  });

  it("empty when no ratings field", () => {
    const prof = { __typename: "Professor", id: "1" };
    expect(getRatingsFromStore({}, prof)).toEqual([]);
  });

  it("ratings via edges __refs (RMP style)", () => {
    const store: Record<string, any> = {
      "Teacher-2823076": {
        __typename: "Teacher",
        legacyId: 2823076,
        "ratings(first:5)": { __ref: "conn:2823076:ratings" },
      },
      "conn:2823076:ratings": {
        __typename: "RatingConnection",
        edges: { __refs: ["edge:0", "edge:1"] },
      },
      "edge:0": { node: { __ref: "Rating-1" } },
      "edge:1": { node: { __ref: "Rating-2" } },
      "Rating-1": {
        __typename: "Rating",
        comment: "First",
        clarityRating: 1,
      },
      "Rating-2": {
        __typename: "Rating",
        comment: "Second",
        clarityRating: 2,
      },
    };
    const ratings = getRatingsFromStore(store, store["Teacher-2823076"]);
    expect(ratings).toHaveLength(2);
    expect(ratings[0].comment).toBe("First");
    expect(ratings[1].comment).toBe("Second");
  });

  it("professor ratings pageInfo when present", () => {
    const store: Record<string, any> = {
      "Teacher-1": {
        __typename: "Teacher",
        legacyId: 1,
        "ratings(first:5)": { __ref: "conn:1:ratings" },
      },
      "conn:1:ratings": {
        edges: { __refs: ["e1"] },
        pageInfo: { __ref: "conn:1:pageInfo" },
      },
      "conn:1:pageInfo": {
        hasNextPage: true,
        endCursor: "YXJyYXljb25uZWN0aW9uOjQ=",
      },
      e1: { node: { __ref: "Rating-1" } },
      "Rating-1": { __typename: "Rating", comment: "One" },
    };
    const info = getProfessorRatingsConnectionPageInfo(
      store,
      store["Teacher-1"]
    );
    expect(info).not.toBeNull();
    expect(info!.hasNextPage).toBe(true);
    expect(info!.endCursor).toBe("YXJyYXljb25uZWN0aW9uOjQ=");
  });

  it("professor ratings pageInfo null when absent", () => {
    const store: Record<string, any> = {
      "Teacher-2823076": {
        __typename: "Teacher",
        legacyId: 2823076,
        "ratings(first:5)": { __ref: "conn:2823076:ratings" },
      },
      "conn:2823076:ratings": {
        __typename: "RatingConnection",
        edges: { __refs: ["edge:0"] },
      },
      "edge:0": { node: { __ref: "Rating-1" } },
      "Rating-1": { __typename: "Rating", comment: "One" },
    };
    const info = getProfessorRatingsConnectionPageInfo(
      store,
      store["Teacher-2823076"]
    );
    expect(info).toBeNull();
  });
});

describe("getSchoolNode", () => {
  it("finds school by legacyId", () => {
    const store: Record<string, any> = {
      "U2Nob29sLTE0NjY=": {
        __typename: "School",
        legacyId: 1466,
        name: "Queen's University at Kingston",
        location: "Kingston, ON",
      },
    };
    const node = getSchoolNode(store, "1466");
    expect(node).not.toBeNull();
    expect(node!.name).toBe("Queen's University at Kingston");
    expect(node!.legacyId).toBe(1466);
  });
});

describe("getSchoolRatingsFromStore", () => {
  it("school ratings via edges __refs (RMP style)", () => {
    const store: Record<string, any> = {
      "School-1466": {
        __typename: "School",
        legacyId: 1466,
        "ratings(first:5)": { __ref: "conn:1466:ratings" },
      },
      "conn:1466:ratings": {
        __typename: "CampusRatingConnection",
        edges: { __refs: ["edge:s0", "edge:s1"] },
      },
      "edge:s0": { node: { __ref: "SchoolRating-1" } },
      "edge:s1": { node: { __ref: "SchoolRating-2" } },
      "SchoolRating-1": {
        __typename: "SchoolRating",
        comment: "Changed my life.",
        reputationRating: 5,
      },
      "SchoolRating-2": {
        __typename: "SchoolRating",
        comment: "Love it here.",
        reputationRating: 5,
      },
    };
    const ratings = getSchoolRatingsFromStore(store, store["School-1466"]);
    expect(ratings).toHaveLength(2);
    expect(ratings[0].comment).toBe("Changed my life.");
    expect(ratings[1].comment).toBe("Love it here.");
  });

  it("school ratings pageInfo when present", () => {
    const store: Record<string, any> = {
      "School-1466": {
        __typename: "School",
        legacyId: 1466,
        "ratings(first:5)": { __ref: "conn:1466:ratings" },
      },
      "conn:1466:ratings": {
        edges: { __refs: ["edge:s0"] },
        pageInfo: { __ref: "conn:1466:pageInfo" },
      },
      "conn:1466:pageInfo": {
        hasNextPage: true,
        endCursor: "c2Nob29sOjE=",
      },
      "edge:s0": { node: { __ref: "SchoolRating-1" } },
      "SchoolRating-1": { __typename: "SchoolRating", comment: "Great" },
    };
    const info = getSchoolRatingsConnectionPageInfo(
      store,
      store["School-1466"]
    );
    expect(info).not.toBeNull();
    expect(info!.hasNextPage).toBe(true);
    expect(info!.endCursor).toBe("c2Nob29sOjE=");
  });
});

describe("getAllRatingRecords", () => {
  it("collects rating typenames", () => {
    const store: Record<string, any> = {
      "node:r1": { __typename: "Rating", id: "r1" },
      "node:r2": { __typename: "ProfessorRating", id: "r2" },
      "node:r3": { __typename: "Review", id: "r3" },
      "node:p": { __typename: "Professor", id: "p" },
    };
    const records = getAllRatingRecords(store);
    expect(records).toHaveLength(3);
    const typenames = new Set(records.map((r) => r.__typename));
    expect(typenames).toEqual(
      new Set(["Rating", "ProfessorRating", "Review"])
    );
  });

  it("ignores non-dict values", () => {
    const store: Record<string, any> = {
      "node:r1": "string",
      "node:r2": { __typename: "Rating" },
    };
    const records = getAllRatingRecords(store);
    expect(records).toHaveLength(1);
  });
});
