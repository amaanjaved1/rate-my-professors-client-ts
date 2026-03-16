# RateMyProfessors API Client (TypeScript)

A typed, retrying, rate-limited **unofficial** client for [RateMyProfessors](https://www.ratemyprofessors.com). Search schools and professors, fetch ratings, and build scripts or tools on top of RMP with a simple API and full TypeScript types.

> **Disclaimer:** This library is unofficial and may break if RMP changes their internal API. Use responsibly and respect rate limits.

## Table of contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quickstart](#quickstart)
- [Common workflows](#common-workflows)
- [API](#api)
- [Configuration](#configuration)
- [Error handling](#error-handling)
- [Types](#types)
- [Running the examples](#running-the-examples)
- [Extras](#extras)

## Requirements

- **Node.js** 18 or later
- TypeScript types are included; the package works in both TypeScript and JavaScript projects.

## Installation

```bash
npm install ratemyprofessors-client
```

## Quickstart

Create a client (uses defaults and optional env vars if you don’t pass config):

```typescript
import { RMPClient } from "ratemyprofessors-client";

const client = new RMPClient();
try {
  // Search schools to get a school ID, or use one from an RMP school URL
  const schools = await client.searchSchools("Queen's University");
  const schoolId = schools.schools[0]?.id; // e.g. "1466"

  if (schoolId) {
    for await (const prof of client.iterProfessorsForSchool(Number(schoolId), {
      page_size: 20,
    })) {
      console.log(prof.name, prof.overall_rating, prof.num_ratings);
    }
  }
} finally {
  await client.close();
}
```

Fetch one professor and iterate their ratings (use an ID from search or from a professor’s RMP URL):

```typescript
import { RMPClient } from "ratemyprofessors-client";

const client = new RMPClient();
try {
  const professor = await client.getProfessor("2823076"); // example ID

  for await (const rating of client.iterProfessorRatings(professor.id, {
    since: new Date("2024-01-01"),
  })) {
    console.log(rating.date, rating.quality, rating.comment);
  }
} finally {
  await client.close();
}
```

## Common workflows

**Search professors by name**

```typescript
const result = await client.searchProfessors("Smith", { page_size: 10 });
for (const prof of result.professors) {
  console.log(prof.name, prof.department, prof.overall_rating);
}
```

**Search schools, then list professors at a school**

```typescript
const schoolResult = await client.searchSchools("Stanford");
const schoolId = schoolResult.schools[0]?.id;
if (schoolId) {
  const profResult = await client.listProfessorsForSchool(Number(schoolId), {
    page: 1,
    page_size: 20,
  });
}
```

**Get one professor and a single page of ratings**

```typescript
const professor = await client.getProfessor(professorId);
const page = await client.getProfessorRatingsPage(professorId, {
  cursor: null,
  page_size: 20,
});
console.log(page.professor.name, page.ratings.length, page.has_next_page);
```

**Get school details and compare two schools**

```typescript
const school = await client.getSchool(schoolId);
const comparison = await client.getCompareSchools(schoolId1, schoolId2);
console.log(comparison.school_1.name, comparison.school_2.name);
```

## API

All I/O methods are `async` and return Promises (or async iterators). Call `client.close()` when done to abort in-flight requests.

### Schools

| Method | Description |
|--------|-------------|
| `searchSchools(query, { page, page_size })` | Search schools by name. Returns `SchoolSearchResult`. |
| `getSchool(schoolId, { use_compare_page })` | Get one school by ID. Returns `School`. |
| `getCompareSchools(schoolId1, schoolId2)` | Get two schools (e.g. from compare page). Returns `CompareSchoolsResult`. |
| `getSchoolRatingsPage(schoolId, { cursor, page_size })` | One page of ratings for a school. Returns `SchoolRatingsPage`. |
| `iterSchoolRatings(schoolId, { page_size, since })` | Async iterator over all ratings for a school. Yields `SchoolRating`. |

### Professors and ratings

| Method | Description |
|--------|-------------|
| `searchProfessors(query, { school_id, page, page_size })` | Search professors by name (optional school). Returns `ProfessorSearchResult`. |
| `listProfessorsForSchool(school_id, { query, page, page_size })` | List professors at a school. Returns `ProfessorSearchResult`. |
| `iterProfessorsForSchool(school_id, { query, page_size })` | Async iterator over all professors at a school. Yields `Professor`. |
| `getProfessor(professorId)` | Get one professor by ID. Returns `Professor`. |
| `getProfessorRatingsPage(professorId, { cursor, page_size })` | One page of ratings for a professor. Returns `ProfessorRatingsPage`. |
| `iterProfessorRatings(professorId, { page_size, since })` | Async iterator over ratings for a professor. Yields `Rating`. |

### Low-level

| Method | Description |
|--------|-------------|
| `rawQuery(payload)` | Send a raw JSON/GraphQL payload to the RMP GraphQL endpoint. Returns the response data. |

## Configuration

If you don’t pass config, the client uses `configFromEnv()`: defaults plus any environment variables below.

| Variable | Description | Default |
|----------|-------------|---------|
| `RMP_CLIENT_BASE_URL` | GraphQL endpoint | `https://www.ratemyprofessors.com/graphql` |
| `RMP_CLIENT_TIMEOUT_SECONDS` | Request timeout (seconds) | `10` |
| `RMP_CLIENT_MAX_RETRIES` | Retries on failure | `3` |
| `RMP_CLIENT_RATE_LIMIT_PER_MINUTE` | Max requests per minute | `60` |

Override with `createConfig`:

```typescript
import { RMPClient, createConfig } from "ratemyprofessors-client";

const client = new RMPClient(
  createConfig({
    base_url: "https://www.ratemyprofessors.com/graphql",
    rate_limit_per_minute: 30,
  }),
);
```

## Error handling

The client can throw:

- **`HttpError`** – Non-2xx response (e.g. 404, 500). Has `status_code`, `url`, and optional `body`.
- **`ParsingError`** – Failed to parse RMP page data (e.g. professor/school not found in store).
- **`RateLimitError`** – Local rate limit exceeded (throttled by the client).
- **`RetryError`** – Request failed after all retries; `last_error` holds the last thrown error.
- **`RMPAPIError`** – GraphQL response contained an `errors` field.

Catch and narrow by type:

```typescript
import { RMPClient, HttpError, ParsingError } from "ratemyprofessors-client";

try {
  const prof = await client.getProfessor(id);
} catch (e) {
  if (e instanceof ParsingError) {
    console.error("Professor not found or page changed:", e.message);
  } else if (e instanceof HttpError) {
    console.error("HTTP", e.status_code, e.url);
  } else {
    throw e;
  }
}
```

## Types

All methods return typed data. You can import the interfaces for your own code:

```typescript
import type {
  School,
  Professor,
  Rating,
  SchoolRating,
  ProfessorSearchResult,
  SchoolSearchResult,
  ProfessorRatingsPage,
  SchoolRatingsPage,
  CompareSchoolsResult,
} from "ratemyprofessors-client";
```

- **School** – `id`, `name`, `location`, `overall_quality`, `num_ratings`, and category ratings (e.g. `reputation`, `safety`).
- **Professor** – `id`, `name`, `department`, `school`, `overall_rating`, `num_ratings`, `tags`, `rating_distribution`, etc.
- **Rating** (professor) – `date`, `comment`, `quality`, `difficulty`, `tags`, `course_raw`, `helpful`, `thumbs_up`/`thumbs_down`.
- **SchoolRating** – `date`, `comment`, `overall`, `category_ratings`, `helpful`, `thumbs_up`/`thumbs_down`.
- **\*SearchResult** / **\*RatingsPage** – Paginated results with `has_next_page` and `next_cursor` where applicable.

## Running the examples

From the repo root:

```bash
npm install
npm run build
npx tsx examples/searchProfessors.ts
npx tsx examples/getProfessor.ts
```

You can add `tsx` as a dev dependency and run via `npm run example:search` (or similar) if you add the scripts to `package.json`.

## Extras

Optional helpers for ingestion pipelines (dedupe, course codes, sentiment) are under the `extras` subpath when available:

```typescript
import {
  normalizeComment,
  isValidComment,
  cleanCourseLabel,
  buildCourseMapping,
  analyzeSentiment,
} from "ratemyprofessors-client/extras";
```

- **dedupe**: `normalizeComment(text)`, `isValidComment(text, minLen?)`
- **course_codes**: `cleanCourseLabel(raw)`, `buildCourseMapping(scrapedLabels, validCourses)`
- **sentiment**: `analyzeSentiment(text, getPolarity)` – you provide a polarity function (e.g. from a sentiment library)
