/**
 * Helpers for normalizing and validating rating comments.
 */

/**
 * Strip HTML tags from text (RMP comments occasionally contain markup).
 */
function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

export interface NormalizeOptions {
  /** Remove HTML tags (default: true) */
  stripHtml?: boolean;
  /** Remove all punctuation (default: false) */
  stripPunctuation?: boolean;
}

/**
 * Normalize a comment for comparison or deduplication.
 *
 * - Trims leading/trailing whitespace
 * - Strips HTML tags (opt-out via `options.stripHtml`)
 * - Lowercases
 * - Collapses runs of whitespace to a single space
 * - Optionally strips punctuation for looser matching
 */
export function normalizeComment(
  text: string,
  options: NormalizeOptions = {},
): string {
  const { stripHtml: html = true, stripPunctuation = false } = options;

  let out = text.trim();
  if (html) out = stripHtml(out);
  out = out.toLowerCase().replace(/\s+/g, " ");
  if (stripPunctuation) out = out.replace(/[^\w\s]/g, "");
  return out;
}

export interface CommentIssue {
  code:
    | "empty"
    | "too_short"
    | "all_caps"
    | "excessive_repeats"
    | "no_alpha";
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: CommentIssue[];
}

/**
 * Validate a comment and return detailed diagnostics.
 *
 * Checks for:
 * - Empty or whitespace-only text
 * - Below minimum length (`minLen`, default 10)
 * - All uppercase (shouting)
 * - Excessive repeated characters (e.g. "aaaaaaa")
 * - No alphabetic characters at all
 */
export function isValidComment(
  text: string,
  minLen: number = 10,
): ValidationResult {
  const issues: CommentIssue[] = [];
  const trimmed = text?.trim() ?? "";

  if (!trimmed) {
    issues.push({ code: "empty", message: "Comment is empty" });
    return { valid: false, issues };
  }

  if (trimmed.length < minLen) {
    issues.push({
      code: "too_short",
      message: `Comment is ${trimmed.length} chars (minimum ${minLen})`,
    });
  }

  if (trimmed.length > 3 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    issues.push({ code: "all_caps", message: "Comment is all uppercase" });
  }

  if (/(.)\1{4,}/i.test(trimmed)) {
    issues.push({
      code: "excessive_repeats",
      message: "Comment contains excessive repeated characters",
    });
  }

  if (!/[a-zA-Z]/.test(trimmed)) {
    issues.push({
      code: "no_alpha",
      message: "Comment contains no alphabetic characters",
    });
  }

  return { valid: issues.length === 0, issues };
}
