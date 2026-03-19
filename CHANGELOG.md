# Changelog

## 2.1.3

- Docs favicon and README badge cache updates.

## 2.1.0

- **Helpers** (formerly dedupe): `normalizeComment` now strips HTML by default and supports optional `stripPunctuation`; `isValidComment` returns a `ValidationResult` with `valid` and `issues` instead of a boolean, checking for empty, too short, all caps, excessive repeats, and no alphabetic characters.
- **Sentiment**: `analyzeSentiment` now uses the `sentiment` package (AFINN-165) directly—no callback required. Returns `score`, `comparative`, and `label`.
- **Python**: Same helper and sentiment changes; `is_valid_comment` returns `ValidationResult`, `normalize_comment` supports `strip_html` and `strip_punctuation` kwargs.
