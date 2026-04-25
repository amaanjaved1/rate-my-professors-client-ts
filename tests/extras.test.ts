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

  it("strips HTML by default", () => {
    expect(normalizeComment("<b>Loved</b> this class")).toBe("loved this class");
  });

  it("decodes HTML entities", () => {
    expect(normalizeComment("great &amp; easy")).toBe("great & easy");
    expect(normalizeComment("<b>bold</b> &amp; great")).toBe("bold & great");
  });

  it("stripHtml option", () => {
    expect(normalizeComment("<b>Bold</b>", { stripHtml: false })).toBe("<b>bold</b>");
  });

  it("stripPunctuation option", () => {
    expect(normalizeComment("Hello, world!", { stripPunctuation: true })).toBe("hello world");
  });
});

describe("isValidComment", () => {
  it("valid with default min_len", () => {
    expect(isValidComment("this is ten!!").valid).toBe(true);
    expect(isValidComment("short").valid).toBe(false);
  });

  it("empty is false", () => {
    expect(isValidComment("").valid).toBe(false);
    expect(isValidComment("   ").valid).toBe(false);
  });

  it("custom min_len", () => {
    expect(isValidComment("five!", 5).valid).toBe(true);
    expect(isValidComment("four", 5).valid).toBe(false);
  });

  it("exactly min_len with alpha", () => {
    expect(isValidComment("hello", 5).valid).toBe(true);
  });

  it("returns issues for invalid comments", () => {
    const short = isValidComment("short");
    expect(short.valid).toBe(false);
    expect(short.issues.some((i) => i.code === "too_short")).toBe(true);

    const allCaps = isValidComment("WORST PROF EVER");
    expect(allCaps.valid).toBe(false);
    expect(allCaps.issues.some((i) => i.code === "all_caps")).toBe(true);

    const noAlpha = isValidComment("12345", 5);
    expect(noAlpha.valid).toBe(false);
    expect(noAlpha.issues.some((i) => i.code === "no_alpha")).toBe(true);
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

  it("four-digit course number match", () => {
    const valid = ["MATH 1001", "CS 1102"];
    const scraped = ["MATH1001", "CS1102"];
    const mapping = buildCourseMapping(scraped, valid);
    expect(mapping.get("MATH1001")).toEqual(new Set(["MATH 1001"]));
    expect(mapping.get("CS1102")).toEqual(new Set(["CS 1102"]));
  });
});
