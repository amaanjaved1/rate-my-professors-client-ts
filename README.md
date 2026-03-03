# RateMyProfessors API Client (TypeScript)

Typed, retrying, rate-limited unofficial client for RateMyProfessors, with optional helpers for ingestion workflows (sentiment, dedupe, course-code normalization).

> Note: This library is **unofficial** and may break if RMP changes their internal API.

## Installation

```bash
npm install ratemyprofessors-client
```

## Quickstart

```typescript
import { RMPClient } from "ratemyprofessors-client";

const SCHOOL_ID = 1466; // example: Queen's University ID on RMP

const client = new RMPClient();
try {
  for await (const prof of client.iterProfessorsForSchool(SCHOOL_ID, { page_size: 20 })) {
    console.log(prof.name, prof.overall_rating, prof.num_ratings);
  }
} finally {
  await client.close();
}
```

Fetch details and iterate ratings:

```typescript
import { RMPClient } from "ratemyprofessors-client";

const client = new RMPClient();
try {
  const professor = await client.getProfessor("PROFESSOR_ID");

  for await (const rating of client.iterProfessorRatings(professor.id, {
    since: new Date("2024-01-01"),
  })) {
    console.log(rating.date, rating.quality, rating.comment);
  }
} finally {
  await client.close();
}
```

## Configuration

Config can be passed to the client or read from the environment:

- `RMP_CLIENT_BASE_URL` – GraphQL endpoint (default: `https://www.ratemyprofessors.com/graphql`)
- `RMP_CLIENT_TIMEOUT_SECONDS` – Request timeout (default: `10`)
- `RMP_CLIENT_MAX_RETRIES` – Retries on failure (default: `3`)
- `RMP_CLIENT_RATE_LIMIT_PER_MINUTE` – Max requests per minute (default: `60`)

```typescript
import { RMPClient, createConfig } from "ratemyprofessors-client";

const client = new RMPClient(
  createConfig({
    base_url: "https://www.ratemyprofessors.com/graphql",
    rate_limit_per_minute: 30,
  })
);
```

## API

- `rawQuery(payload)` – Send a raw JSON/GraphQL payload
- `searchSchools(query, { page, page_size })` – Search schools by name
- `searchProfessors(query, { school_id, page, page_size })` – Search professors
- `listProfessorsForSchool(school_id, { query, page, page_size })` – List professors at a school
- `iterProfessorsForSchool(school_id, { query, page_size })` – Async iterator over all professors at a school
- `getProfessor(professor_id)` – Get one professor by ID
- `getProfessorRatingsPage(professor_id, { cursor, page_size })` – One page of ratings
- `iterProfessorRatings(professor_id, { page_size, since })` – Async iterator over ratings

All methods that perform I/O are `async` and return Promises (or async iterators).

## Extras

Optional helpers are under the `extras` subpath:

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

## Publishing to npm

1. Log in: `npm login`
2. Bump version in `package.json` (or use `npm version patch`)
3. Build and publish: `npm run build && npm publish`

For scoped or public publish, ensure `package.json` `name` and `repository` match your npm package.
