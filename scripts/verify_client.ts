#!/usr/bin/env npx tsx
/**
 * Verify the RMP client against the live site.
 *
 * Fetches a known professor (Erin Meger, Queen's) and school (Queen's 1466),
 * plus professor/school search, compare schools, and up to N pages of ratings
 * for each, then prints key fields so you can confirm parsing matches the website.
 *
 * The first page of ratings comes from the HTML; subsequent pages are fetched
 * via the site's GraphQL API, so you can scrape all ratings by using a high
 * --max-pages or iterProfessorRatings / iterSchoolRatings in code.
 *
 * Usage (from repo root):
 *   npx tsx scripts/verify_client.ts
 *   npx tsx scripts/verify_client.ts --page-size 20
 *   npx tsx scripts/verify_client.ts --max-pages 10
 */

import { RMPClient } from "../src/index.js";
import { RMPAPIError } from "../src/errors.js";
import type { School } from "../src/models.js";

function parseArgs(): { pageSize: number; maxPages: number } {
  const args = process.argv.slice(2);
  let pageSize = 5;
  let maxPages = 3;
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--page-size" || args[i] === "-n") && args[i + 1]) {
      pageSize = Math.max(1, Number(args[++i]));
    } else if (args[i] === "--max-pages" && args[i + 1]) {
      maxPages = Math.max(1, Number(args[++i]));
    }
  }
  return { pageSize, maxPages };
}

function truncate(s: string, len = 80): string {
  return s.length > len ? s.slice(0, len) + "..." : s;
}

const CAT_KEYS = [
  "reputation",
  "safety",
  "happiness",
  "facilities",
  "social",
  "location_rating",
  "clubs",
  "opportunities",
  "internet",
  "food",
] as const;

function printSchoolCategories(school: School, indent = "  "): void {
  const cats: string[] = [];
  for (const k of CAT_KEYS) {
    const v = school[k];
    if (v != null) cats.push(`${k}=${v}`);
  }
  if (cats.length > 0) {
    console.log(`${indent}categories:      ${cats.join(", ")}`);
  }
}

async function main(): Promise<number> {
  const { pageSize, maxPages } = parseArgs();

  const professorId = "2823076"; // Erin Meger, Queen's University
  const schoolId = "1466"; // Queen's University at Kingston

  const client = new RMPClient();

  try {
    // ---- Professor ----
    console.log("Fetching professor page ...");
    const prof = await client.getProfessor(professorId);

    console.log("\n--- Professor ---");
    console.log(`  id:          ${prof.id}`);
    console.log(`  name:        ${prof.name}`);
    console.log(`  department:  ${prof.department}`);
    if (prof.school) {
      console.log(
        `  school:      ${prof.school.name} (${prof.school.location ?? "N/A"})`
      );
    }
    console.log(`  rating:      ${prof.overall_rating}/5`);
    console.log(`  num_ratings: ${prof.num_ratings}`);
    console.log(`  would take again: ${prof.percent_take_again}%`);
    console.log(`  difficulty:  ${prof.level_of_difficulty}/5`);
    if (prof.tags.length > 0) {
      const shown = prof.tags.slice(0, 10).join(", ");
      console.log(
        `  tags:        ${shown}${prof.tags.length > 10 ? " ..." : ""}`
      );
    }
    if (prof.rating_distribution) {
      const parts: string[] = [];
      for (const level of Object.keys(prof.rating_distribution)
        .map(Number)
        .sort()) {
        const b = prof.rating_distribution[level];
        parts.push(`${level}=${b.count}(${b.percentage}%)`);
      }
      console.log(`  distribution (1-5):  ${parts.join("  ")}`);
    }

    // ---- Professor ratings ----
    console.log(
      `\nFetching up to ${maxPages} page(s) of professor ratings (page_size=${pageSize}) ...`
    );
    let profTotal = 0;
    let cursor: string | null = null;
    for (let pageNum = 0; pageNum < maxPages; pageNum++) {
      const profPage = await client.getProfessorRatingsPage(professorId, {
        cursor,
        page_size: pageSize,
      });
      console.log(
        `--- Professor ratings (page ${pageNum + 1}, has_next=${profPage.has_next_page}) ---`
      );
      for (let i = 0; i < profPage.ratings.length; i++) {
        const r = profPage.ratings[i];
        const idx = profTotal + i + 1;
        const dateStr = r.date.toISOString().slice(0, 10);
        console.log(
          `  ${idx}. ${dateStr} | quality=${r.quality} difficulty=${r.difficulty} | ${r.course_raw ?? "N/A"}`
        );
        console.log(`     ${truncate(r.comment)}`);
        if (r.tags.length > 0) {
          console.log(`     tags: ${r.tags.join(", ")}`);
        }
      }
      profTotal += profPage.ratings.length;
      if (!profPage.has_next_page || !profPage.next_cursor) break;
      cursor = profPage.next_cursor;
    }
    console.log(`  (shown ${profTotal} professor ratings)`);

    // ---- Professor search ----
    console.log("\nSearching professors (q=test) ...");
    const searchResult = await client.searchProfessors("test");
    console.log(
      `--- Professor search: total=${searchResult.total} has_next=${searchResult.has_next_page} ---`
    );
    for (let i = 0; i < Math.min(5, searchResult.professors.length); i++) {
      const p = searchResult.professors[i];
      const schoolName = p.school?.name ?? "N/A";
      console.log(
        `  ${i + 1}. ${p.name} | ${p.department ?? "N/A"} @ ${schoolName} | rating=${p.overall_rating} n=${p.num_ratings}`
      );
    }

    // ---- School search ----
    console.log("\nSearching schools (q=queens) ...");
    const schoolSearch = await client.searchSchools("queens");
    console.log(
      `--- School search: total=${schoolSearch.total} has_next=${schoolSearch.has_next_page} ---`
    );
    for (let i = 0; i < Math.min(5, schoolSearch.schools.length); i++) {
      const s = schoolSearch.schools[i];
      console.log(
        `  ${i + 1}. ${s.name} | ${s.location ?? "N/A"} | quality=${s.overall_quality} n=${s.num_ratings}`
      );
    }

    // ---- School ----
    console.log("\nFetching school page ...");
    const school = await client.getSchool(schoolId);

    console.log("\n--- School ---");
    console.log(`  id:              ${school.id}`);
    console.log(`  name:            ${school.name}`);
    console.log(`  location:        ${school.location ?? "N/A"}`);
    console.log(`  overall_quality: ${school.overall_quality}/5`);
    console.log(`  num_ratings:     ${school.num_ratings}`);
    printSchoolCategories(school);

    // ---- School ratings ----
    console.log(
      `\nFetching up to ${maxPages} page(s) of school ratings (page_size=${pageSize}) ...`
    );
    let schoolTotal = 0;
    cursor = null;
    for (let pageNum = 0; pageNum < maxPages; pageNum++) {
      const schoolPage = await client.getSchoolRatingsPage(schoolId, {
        cursor,
        page_size: pageSize,
      });
      console.log(
        `--- School ratings (page ${pageNum + 1}, has_next=${schoolPage.has_next_page}) ---`
      );
      for (let i = 0; i < schoolPage.ratings.length; i++) {
        const r = schoolPage.ratings[i];
        const idx = schoolTotal + i + 1;
        const dateStr = r.date.toISOString().slice(0, 10);
        const overallStr = r.overall != null ? ` overall=${r.overall}` : "";
        console.log(`  ${idx}. ${dateStr}${overallStr}`);
        console.log(`     ${truncate(r.comment)}`);
        if (r.category_ratings) {
          const entries = Object.entries(r.category_ratings).slice(0, 5);
          const parts = entries.map(([k, v]) => `${k}=${v}`);
          console.log(
            `     categories: ${parts.join(", ")}${Object.keys(r.category_ratings).length > 5 ? " ..." : ""}`
          );
        }
      }
      schoolTotal += schoolPage.ratings.length;
      if (!schoolPage.has_next_page || !schoolPage.next_cursor) break;
      cursor = schoolPage.next_cursor;
    }
    console.log(`  (shown ${schoolTotal} school ratings)`);

    // ---- Compare schools ----
    console.log("\nFetching compare schools (1466 vs 1491) ...");
    const compare = await client.getCompareSchools("1466", "1491");
    console.log("--- Compare schools ---");
    for (const [label, s] of [
      ["School 1", compare.school_1],
      ["School 2", compare.school_2],
    ] as const) {
      console.log(`\n  ${label}: ${s.name}`);
      console.log(`    id:              ${s.id}`);
      console.log(`    location:        ${s.location ?? "N/A"}`);
      console.log(`    overall_quality: ${s.overall_quality}/5`);
      console.log(`    num_ratings:     ${s.num_ratings}`);
      printSchoolCategories(s, "    ");
    }
  } catch (e) {
    if (e instanceof RMPAPIError) {
      console.error(`Error: ${e.message}`);
      if (e.details) {
        console.error("API error details:");
        console.error(JSON.stringify(e.details, null, 2));
      }
      return 1;
    }
    console.error(`Error: ${e}`);
    return 1;
  } finally {
    await client.close();
  }

  console.log("\nDone. Client verification OK.");
  return 0;
}

main().then((code) => process.exit(code));
