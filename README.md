# RateMyProfessors API Client (TypeScript)

[![npm downloads](https://img.shields.io/npm/dt/ratemyprofessors-client)](https://www.npmjs.com/package/ratemyprofessors-client)

A typed, retrying, rate-limited **unofficial** client for [RateMyProfessors](https://www.ratemyprofessors.com).

> **Looking for a Python version?** Check out [RateMyProfessors API Client (Python)](https://pypi.org/project/ratemyprofessors-client).

## Requirements

- **Node.js 18** or later
- Works in both TypeScript and JavaScript projects (types included)

## Installation

```bash
npm install ratemyprofessors-client
```

## Available Functions

Create a client and call any of these methods. See the [full docs](https://amaanjaved1.github.io/rate-my-professors-client-ts/) for parameters, return types, and examples.

```typescript
import { RMPClient } from "ratemyprofessors-client";
const client = new RMPClient();
```

**Schools**

- `searchSchools(query)` — Search schools by name. Returns paginated results.
- `getSchool(schoolId)` — Get a single school by its numeric ID.
- `getCompareSchools(schoolId1, schoolId2)` — Fetch two schools side by side.
- `getSchoolRatingsPage(schoolId)` — Get one page of school ratings (cached after first fetch).
- `iterSchoolRatings(schoolId)` — Async iterator over all ratings for a school.

**Professors**

- `searchProfessors(query)` — Search professors by name. Returns paginated results.
- `listProfessorsForSchool(schoolId)` — List professors at a given school.
- `iterProfessorsForSchool(schoolId)` — Async iterator over all professors at a school.
- `getProfessor(professorId)` — Get a single professor by their numeric ID.
- `getProfessorRatingsPage(professorId)` — Get one page of professor ratings (cached after first fetch).
- `iterProfessorRatings(professorId)` — Async iterator over all ratings for a professor.

**Low-level**

- `rawQuery(payload)` — Send a raw GraphQL payload to the RMP endpoint.

**Lifecycle**

- `close()` — Close the client, abort in-flight requests, and clear caches.

## Errors and What They Mean

All errors extend `RMPError`. Catch and narrow with `instanceof`:

- **`HttpError`** — The server returned a non-2xx status code (e.g. 404, 500).
- **`ParsingError`** — The response couldn't be parsed (e.g. professor/school not found).
- **`RateLimitError`** — The client's local rate limiter blocked the request.
- **`RetryError`** — The request failed after all retry attempts. Contains the last underlying error.
- **`RMPAPIError`** — The GraphQL API returned an `errors` array in the response.
- **`ConfigurationError`** — Invalid client configuration (e.g. missing URL).

```typescript
import { RMPClient, HttpError, ParsingError } from "ratemyprofessors-client";

try {
  const prof = await client.getProfessor(id);
} catch (e) {
  if (e instanceof ParsingError) console.error("Not found:", e.message);
  else if (e instanceof HttpError) console.error("HTTP", e.status_code);
  else throw e;
}
```

## Types

All methods return typed data. Import any of these interfaces:

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

- **`School`** — ID, name, location, overall quality, category ratings (reputation, safety, etc.)
- **`Professor`** — ID, name, department, school, overall rating, difficulty, percent take again
- **`Rating`** — Date, comment, quality, difficulty, tags, course, thumbs up/down
- **`SchoolRating`** — Date, comment, overall score, category ratings, thumbs up/down
- **`ProfessorSearchResult`** / **`SchoolSearchResult`** — Paginated list with `has_next_page` and `next_cursor`
- **`ProfessorRatingsPage`** / **`SchoolRatingsPage`** — One page of ratings with cursor pagination
- **`CompareSchoolsResult`** — A pair of schools

## Extras

Optional helpers for data pipelines are available under the `extras` subpath:

```typescript
import {
  normalizeComment,
  isValidComment,
  cleanCourseLabel,
  buildCourseMapping,
  analyzeSentiment,
} from "ratemyprofessors-client/extras";
```

- `normalizeComment(text)` — Normalize text for deduplication (lowercase, collapse whitespace)
- `isValidComment(text, minLen?)` — Check if a comment is non-empty and meets a minimum length
- `cleanCourseLabel(raw)` — Clean scraped course labels (remove counts, normalize whitespace)
- `buildCourseMapping(scraped, valid)` — Map scraped labels to known course codes
- `analyzeSentiment(text, getPolarity)` — Compute sentiment label from a polarity function
