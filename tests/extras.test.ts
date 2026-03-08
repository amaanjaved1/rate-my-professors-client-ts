import { describe, it, expect } from "vitest";
import {
  normalizeComment,
  isValidComment,
  cleanCourseLabel,
  buildCourseMapping,
} from "../src/extras/index.js";

describe("normalizeComment", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeComment("  Hello   World!  ")).toBe("hello world!");
  });

  it("empty after strip", () => {
    expect(normalizeComment("   ")).toBe("");
  });

  it("single word", () => {
    expect(normalizeComment("GREAT")).toBe("great");
  });

  it("newlines collapsed", () => {
    expect(normalizeComment("a\nb\nc")).toBe("a b c");
  });

  it("unicode preserved", () => {
    expect(normalizeComment("  Café  ")).toBe("café");
  });
});

describe("isValidComment", () => {
  it("valid with default min_len", () => {
    expect(isValidComment("this is ten!!")).toBe(true);
    expect(isValidComment("short")).toBe(false);
  });

  it("empty is false", () => {
    expect(isValidComment("")).toBe(false);
    expect(isValidComment("   ")).toBe(false);
  });

  it("custom min_len", () => {
    expect(isValidComment("five!", 5)).toBe(true);
    expect(isValidComment("four", 5)).toBe(false);
  });

  it("exactly min_len", () => {
    expect(isValidComment("12345", 5)).toBe(true);
  });
});

describe("cleanCourseLabel", () => {
  it("removes count parens", () => {
    expect(cleanCourseLabel("MATH 101 (12)")).toBe("MATH 101");
    expect(cleanCourseLabel("CS 50 (3)")).toBe("CS 50");
  });

  it("collapses whitespace", () => {
    expect(cleanCourseLabel("  ANAT   215  ")).toBe("ANAT 215");
  });

  it("no parens unchanged except trim", () => {
    expect(cleanCourseLabel("MATH 101")).toBe("MATH 101");
  });
});

describe("buildCourseMapping", () => {
  it("exact match case-insensitive", () => {
    const valid = ["MATH 101", "ANAT 215"];
    const scraped = ["MATH 101", "math 101", "ANAT 215"];
    const mapping = buildCourseMapping(scraped, valid);
    expect(mapping.get("MATH 101")).toEqual(new Set(["MATH 101"]));
    expect(mapping.get("math 101")).toEqual(new Set(["MATH 101"]));
    expect(mapping.get("ANAT 215")).toEqual(new Set(["ANAT 215"]));
  });

  it("prefix+number match", () => {
    const valid = ["ANAT 215"];
    const scraped = ["ANAT215", "anat 215"];
    const mapping = buildCourseMapping(scraped, valid);
    expect(mapping.get("ANAT215")).toEqual(new Set(["ANAT 215"]));
    expect(mapping.get("anat 215")).toEqual(new Set(["ANAT 215"]));
  });

  it("unknown returns null", () => {
    const valid = ["MATH 101"];
    const scraped = ["UNKNOWN 999"];
    const mapping = buildCourseMapping(scraped, valid);
    expect(mapping.get("UNKNOWN 999")).toBeNull();
  });

  it("empty valid", () => {
    const mapping = buildCourseMapping(["MATH 101"], []);
    expect(mapping.get("MATH 101")).toBeNull();
  });
});
