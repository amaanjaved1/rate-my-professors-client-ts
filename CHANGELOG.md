# Changelog

## 3.0.2

- Docs redesign: new typography (Newsreader + Hanken Grotesk + IBM Plex Mono), warm editorial colour scheme, per-package accent colours, copy buttons on code blocks, and improved dark mode.

## 2.1.5

- Version bump for publish.

## 2.1.2

- Docs favicon and README badge cache updates.

## 2.1.0

- **Helpers** (formerly dedupe): `normalizeComment` now strips HTML by default and supports optional `stripPunctuation`; `isValidComment` returns a `ValidationResult` with `valid` and `issues` instead of a boolean, checking for empty, too short, all caps, excessive repeats, and no alphabetic characters.
- **Sentiment**: `analyzeSentiment` now uses the `sentiment` package (AFINN-165) directly—no callback required. Returns `score`, `comparative`, and `label`.
- **Python**: Same helper and sentiment changes; `is_valid_comment` returns `ValidationResult`, `normalize_comment` supports `strip_html` and `strip_punctuation` kwargs.
