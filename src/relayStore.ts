/**
 * Extract and parse window.__RELAY_STORE__ from RMP page HTML.
 */

type Store = Record<string, unknown>;
type StoreRecord = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Core utilities
// ---------------------------------------------------------------------------

export function extractRelayStore(html: string): Store {
  const marker = "window.__RELAY_STORE__";
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) {
    throw new Error("__RELAY_STORE__ not found in HTML");
  }

  let start = html.indexOf("=", markerIdx + marker.length) + 1;
  start = html.indexOf("{", start);

  let depth = 0;
  let end = start;
  let inString = false;
  let escape = false;
  let quote: string | null = null;

  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") {
        escape = true;
      } else if (c === quote) {
        inString = false;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      quote = c;
      continue;
    }
    if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (depth !== 0) {
    throw new Error("__RELAY_STORE__: unclosed JSON object");
  }

  return JSON.parse(html.slice(start, end)) as Store;
}

export function isRecordRef(value: unknown): value is { __ref: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "__ref" in value &&
    Object.keys(value).length === 1
  );
}

export function resolveRef(
  store: Store,
  ref: { __ref: string }
): StoreRecord | null {
  const recordId = ref.__ref;
  if (!recordId) return null;
  const record = store[recordId];
  return typeof record === "object" && record !== null
    ? (record as StoreRecord)
    : null;
}

export function resolveRefs(
  store: Store,
  refIds: string[]
): StoreRecord[] {
  const out: StoreRecord[] = [];
  for (const refId of refIds ?? []) {
    if (typeof refId !== "string") continue;
    const rec = store[refId];
    if (typeof rec === "object" && rec !== null) {
      out.push(rec as StoreRecord);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Professor / Teacher
// ---------------------------------------------------------------------------

export function getProfessorNode(
  store: Store,
  professorId: string
): StoreRecord | null {
  const idStr = String(professorId);
  for (const record of Object.values(store)) {
    if (typeof record !== "object" || record === null) continue;
    const rec = record as StoreRecord;
    if (rec.__typename !== "Professor" && rec.__typename !== "Teacher") continue;
    const legacy = rec.legacyId;
    if (legacy != null && String(legacy) === idStr) return rec;
    const rid = rec.id ?? rec.__id;
    if (rid != null && String(rid) === idStr) return rec;
  }
  return null;
}

function getRatingsConnectionRef(
  professorRecord: StoreRecord
): { __ref: string } | null {
  for (const key of ["ratings(first:5)", "ratings"]) {
    const val = professorRecord[key];
    if (isRecordRef(val)) return val;
  }
  for (const [key, val] of Object.entries(professorRecord)) {
    if (key.startsWith("ratings") && isRecordRef(val)) return val;
  }
  return null;
}

function edgesToRatingRecords(
  store: Store,
  edgesValue: unknown
): StoreRecord[] {
  const ratings: StoreRecord[] = [];
  const ratingTypenames = new Set(["Rating", "ProfessorRating", "Review"]);

  if (Array.isArray(edgesValue)) {
    for (const edge of edgesValue) {
      if (typeof edge !== "object" || edge === null) continue;
      const node = (edge as StoreRecord).node;
      if (isRecordRef(node)) {
        const rec = resolveRef(store, node);
        if (rec && ratingTypenames.has(rec.__typename as string)) {
          ratings.push(rec);
        }
      } else if (typeof node === "object" && node !== null) {
        ratings.push(node as StoreRecord);
      }
    }
    return ratings;
  }

  if (
    typeof edgesValue === "object" &&
    edgesValue !== null &&
    "__refs" in edgesValue
  ) {
    const edgeRefs =
      ((edgesValue as StoreRecord).__refs as string[]) ?? [];
    for (const refId of edgeRefs) {
      const edgeRecord =
        typeof refId === "string" ? store[refId] : undefined;
      if (typeof edgeRecord !== "object" || edgeRecord === null) continue;
      const node = (edgeRecord as StoreRecord).node;
      if (isRecordRef(node)) {
        const ratingRecord = resolveRef(store, node);
        if (
          ratingRecord &&
          ratingTypenames.has(ratingRecord.__typename as string)
        ) {
          ratings.push(ratingRecord);
        }
      } else if (typeof node === "object" && node !== null) {
        ratings.push(node as StoreRecord);
      }
    }
  }
  return ratings;
}

function getProfessorRatingsConnection(
  store: Store,
  professorRecord: StoreRecord
): StoreRecord | null {
  const ratingsRef = getRatingsConnectionRef(professorRecord);
  if (ratingsRef) return resolveRef(store, ratingsRef);
  const ratingsField = professorRecord.ratings;
  if (
    typeof ratingsField === "object" &&
    ratingsField !== null &&
    "edges" in ratingsField
  ) {
    return ratingsField as StoreRecord;
  }
  return null;
}

export function getProfessorRatingsConnectionPageInfo(
  store: Store,
  professorRecord: StoreRecord
): StoreRecord | null {
  const conn = getProfessorRatingsConnection(store, professorRecord);
  if (!conn) return null;
  const pageInfoRef = conn.pageInfo;
  if (!isRecordRef(pageInfoRef)) return null;
  const info = resolveRef(store, pageInfoRef);
  return info && typeof info === "object" ? info : null;
}

export function getRatingsFromStore(
  store: Store,
  professorRecord: StoreRecord
): StoreRecord[] {
  const conn = getProfessorRatingsConnection(store, professorRecord);
  if (!conn) return [];
  return edgesToRatingRecords(store, conn.edges);
}

export function getAllRatingRecords(store: Store): StoreRecord[] {
  const out: StoreRecord[] = [];
  const ratingTypenames = new Set(["Rating", "ProfessorRating", "Review"]);
  for (const record of Object.values(store)) {
    if (typeof record !== "object" || record === null) continue;
    if (ratingTypenames.has((record as StoreRecord).__typename as string)) {
      out.push(record as StoreRecord);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// School
// ---------------------------------------------------------------------------

export function getSchoolNode(
  store: Store,
  schoolId: string
): StoreRecord | null {
  const sid = String(schoolId);
  for (const [key, record] of Object.entries(store)) {
    if (typeof record !== "object" || record === null) continue;
    const rec = record as StoreRecord;
    if (rec.__typename !== "School" && rec.__typename !== "University") continue;
    const legacy = rec.legacyId;
    if (legacy != null && String(legacy) === sid) return rec;
    const rid = rec.id ?? rec.__id;
    if (rid != null && String(rid) === sid) return rec;
    try {
      const decoded = atob(key);
      if (decoded.includes(sid)) return rec;
    } catch {
      // not base64
    }
    if (key.includes(sid)) return rec;
  }
  // Fallback: if exactly one school record exists, return it
  const schools = Object.values(store).filter(
    (r) =>
      typeof r === "object" &&
      r !== null &&
      ((r as StoreRecord).__typename === "School" ||
        (r as StoreRecord).__typename === "University")
  ) as StoreRecord[];
  if (schools.length === 1) return schools[0];
  return null;
}

function getSchoolRatingsConnectionRef(
  schoolRecord: StoreRecord
): { __ref: string } | null {
  for (const key of ["ratings(first:5)", "ratings"]) {
    const val = schoolRecord[key];
    if (isRecordRef(val)) return val;
  }
  for (const [key, val] of Object.entries(schoolRecord)) {
    if (key.startsWith("ratings") && isRecordRef(val)) return val;
  }
  return null;
}

function edgesToSchoolRatingRecords(
  store: Store,
  edgesValue: unknown
): StoreRecord[] {
  const ratings: StoreRecord[] = [];
  const schoolTypenames = new Set([
    "SchoolRating",
    "Rating",
    "SchoolReview",
    "Review",
  ]);

  if (Array.isArray(edgesValue)) {
    for (const edge of edgesValue) {
      if (typeof edge !== "object" || edge === null) continue;
      const node = (edge as StoreRecord).node;
      if (isRecordRef(node)) {
        const rec = resolveRef(store, node);
        if (rec && schoolTypenames.has(rec.__typename as string)) {
          ratings.push(rec);
        }
      } else if (typeof node === "object" && node !== null) {
        ratings.push(node as StoreRecord);
      }
    }
    return ratings;
  }

  if (
    typeof edgesValue === "object" &&
    edgesValue !== null &&
    "__refs" in edgesValue
  ) {
    const edgeRefs =
      ((edgesValue as StoreRecord).__refs as string[]) ?? [];
    for (const refId of edgeRefs) {
      const edgeRecord =
        typeof refId === "string" ? store[refId] : undefined;
      if (typeof edgeRecord !== "object" || edgeRecord === null) continue;
      const node = (edgeRecord as StoreRecord).node;
      if (isRecordRef(node)) {
        const ratingRecord = resolveRef(store, node);
        if (
          ratingRecord &&
          schoolTypenames.has(ratingRecord.__typename as string)
        ) {
          ratings.push(ratingRecord);
        }
      } else if (typeof node === "object" && node !== null) {
        ratings.push(node as StoreRecord);
      }
    }
  }
  return ratings;
}

function getSchoolRatingsConnection(
  store: Store,
  schoolRecord: StoreRecord
): StoreRecord | null {
  const ratingsRef = getSchoolRatingsConnectionRef(schoolRecord);
  if (ratingsRef) return resolveRef(store, ratingsRef);
  const ratingsField = schoolRecord.ratings;
  if (
    typeof ratingsField === "object" &&
    ratingsField !== null &&
    "edges" in ratingsField
  ) {
    return ratingsField as StoreRecord;
  }
  if (isRecordRef(ratingsField)) return resolveRef(store, ratingsField);
  return null;
}

export function getSchoolRatingsConnectionPageInfo(
  store: Store,
  schoolRecord: StoreRecord
): StoreRecord | null {
  const conn = getSchoolRatingsConnection(store, schoolRecord);
  if (!conn) return null;
  const pageInfoRef = conn.pageInfo;
  if (!isRecordRef(pageInfoRef)) return null;
  const info = resolveRef(store, pageInfoRef);
  return info && typeof info === "object" ? info : null;
}

export function getSchoolRatingsFromStore(
  store: Store,
  schoolRecord: StoreRecord
): StoreRecord[] {
  const conn = getSchoolRatingsConnection(store, schoolRecord);
  if (!conn) return [];
  return edgesToSchoolRatingRecords(store, conn.edges);
}

export function getAllSchoolRatingRecords(store: Store): StoreRecord[] {
  const out: StoreRecord[] = [];
  const schoolTypenames = new Set([
    "Rating",
    "SchoolRating",
    "Review",
    "SchoolReview",
  ]);
  for (const record of Object.values(store)) {
    if (typeof record !== "object" || record === null) continue;
    if (schoolTypenames.has((record as StoreRecord).__typename as string)) {
      out.push(record as StoreRecord);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Professor search page (/search/professors/?q=...)
// ---------------------------------------------------------------------------

export function getTeacherSearchConnection(
  store: Store
): StoreRecord | null {
  const root = store["client:root"];
  if (typeof root !== "object" || root === null) return null;
  const newSearchRef = (root as StoreRecord).newSearch;
  if (!isRecordRef(newSearchRef)) return null;
  const newSearch = resolveRef(store, newSearchRef);
  if (!newSearch) return null;
  for (const [key, val] of Object.entries(newSearch)) {
    if (key.startsWith("teachers(") && isRecordRef(val)) {
      const conn = resolveRef(store, val);
      if (conn && conn.edges != null) return conn;
    }
  }
  return null;
}

export function edgesToTeacherRecords(
  store: Store,
  edgesValue: unknown
): StoreRecord[] {
  const teachers: StoreRecord[] = [];
  const teacherTypenames = new Set(["Teacher", "Professor"]);

  if (Array.isArray(edgesValue)) {
    for (const edge of edgesValue) {
      if (typeof edge !== "object" || edge === null) continue;
      const node = (edge as StoreRecord).node;
      if (isRecordRef(node)) {
        const rec = resolveRef(store, node);
        if (rec && teacherTypenames.has(rec.__typename as string)) {
          teachers.push(rec);
        }
      } else if (
        typeof node === "object" &&
        node !== null &&
        teacherTypenames.has((node as StoreRecord).__typename as string)
      ) {
        teachers.push(node as StoreRecord);
      }
    }
    return teachers;
  }

  if (
    typeof edgesValue === "object" &&
    edgesValue !== null &&
    "__refs" in edgesValue
  ) {
    const edgeRefs =
      ((edgesValue as StoreRecord).__refs as string[]) ?? [];
    for (const refId of edgeRefs) {
      const edgeRecord =
        typeof refId === "string" ? store[refId] : undefined;
      if (typeof edgeRecord !== "object" || edgeRecord === null) continue;
      const node = (edgeRecord as StoreRecord).node;
      if (isRecordRef(node)) {
        const rec = resolveRef(store, node);
        if (rec && teacherTypenames.has(rec.__typename as string)) {
          teachers.push(rec);
        }
      } else if (
        typeof node === "object" &&
        node !== null &&
        teacherTypenames.has((node as StoreRecord).__typename as string)
      ) {
        teachers.push(node as StoreRecord);
      }
    }
  }
  return teachers;
}

export function getTeacherSearchResultCount(
  connection: StoreRecord
): number | null {
  const val = connection.resultCount;
  return val != null ? Number(val) : null;
}

export function getTeacherSearchPageInfo(
  store: Store,
  connection: StoreRecord
): StoreRecord | null {
  const pageInfoRef = connection.pageInfo;
  if (!isRecordRef(pageInfoRef)) return null;
  const info = resolveRef(store, pageInfoRef);
  return info && typeof info === "object" ? info : null;
}

// ---------------------------------------------------------------------------
// School search page (/search/schools?q=...)
// ---------------------------------------------------------------------------

export function getSchoolSearchConnection(
  store: Store
): StoreRecord | null {
  const root = store["client:root"];
  if (typeof root !== "object" || root === null) return null;
  const newSearchRef = (root as StoreRecord).newSearch;
  if (!isRecordRef(newSearchRef)) return null;
  const newSearch = resolveRef(store, newSearchRef);
  if (!newSearch) return null;
  for (const [key, val] of Object.entries(newSearch)) {
    if (key.startsWith("schools(") && isRecordRef(val)) {
      const conn = resolveRef(store, val);
      if (conn && conn.edges != null) return conn;
    }
  }
  return null;
}

export function edgesToSchoolRecords(
  store: Store,
  edgesValue: unknown
): StoreRecord[] {
  const schools: StoreRecord[] = [];
  const schoolTypenames = new Set(["School", "University"]);

  if (Array.isArray(edgesValue)) {
    for (const edge of edgesValue) {
      if (typeof edge !== "object" || edge === null) continue;
      const node = (edge as StoreRecord).node;
      if (isRecordRef(node)) {
        const rec = resolveRef(store, node);
        if (rec && schoolTypenames.has(rec.__typename as string)) {
          schools.push(rec);
        }
      } else if (
        typeof node === "object" &&
        node !== null &&
        schoolTypenames.has((node as StoreRecord).__typename as string)
      ) {
        schools.push(node as StoreRecord);
      }
    }
    return schools;
  }

  if (
    typeof edgesValue === "object" &&
    edgesValue !== null &&
    "__refs" in edgesValue
  ) {
    const edgeRefs =
      ((edgesValue as StoreRecord).__refs as string[]) ?? [];
    for (const refId of edgeRefs) {
      const edgeRecord =
        typeof refId === "string" ? store[refId] : undefined;
      if (typeof edgeRecord !== "object" || edgeRecord === null) continue;
      const node = (edgeRecord as StoreRecord).node;
      if (isRecordRef(node)) {
        const rec = resolveRef(store, node);
        if (rec && schoolTypenames.has(rec.__typename as string)) {
          schools.push(rec);
        }
      } else if (
        typeof node === "object" &&
        node !== null &&
        schoolTypenames.has((node as StoreRecord).__typename as string)
      ) {
        schools.push(node as StoreRecord);
      }
    }
  }
  return schools;
}

export function getSchoolSearchResultCount(
  connection: StoreRecord
): number | null {
  const val = connection.resultCount;
  return val != null ? Number(val) : null;
}

export function getSchoolSearchPageInfo(
  store: Store,
  connection: StoreRecord
): StoreRecord | null {
  const pageInfoRef = connection.pageInfo;
  if (!isRecordRef(pageInfoRef)) return null;
  const info = resolveRef(store, pageInfoRef);
  return info && typeof info === "object" ? info : null;
}
