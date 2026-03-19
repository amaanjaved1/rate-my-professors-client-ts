/**
 * Sentiment analysis for rating comments using the AFINN-165 lexicon.
 */

import Sentiment from "sentiment";

const analyzer = new Sentiment();

export type SentimentLabel =
  | "very positive"
  | "positive"
  | "neutral"
  | "negative"
  | "very negative";

export interface SentimentResult {
  /** Raw aggregate AFINN score (unbounded integer). */
  score: number;
  /** Normalized score per word, typically in [-1, 1]. */
  comparative: number;
  /** Human-readable label derived from the comparative score. */
  label: SentimentLabel;
}

function toLabel(comparative: number): SentimentLabel {
  if (comparative > 0.5) return "very positive";
  if (comparative > 0.2) return "positive";
  if (comparative < -0.5) return "very negative";
  if (comparative < -0.2) return "negative";
  return "neutral";
}

/**
 * Analyze the sentiment of a comment.
 *
 * Uses the AFINN-165 word list + Emoji Sentiment Ranking under the hood.
 * No external API calls -- everything runs locally.
 *
 * ```ts
 * import { analyzeSentiment } from "ratemyprofessors-client/extras";
 *
 * const result = analyzeSentiment("Great professor, really clear lectures!");
 * console.log(result.label);       // "positive"
 * console.log(result.comparative); // 0.5
 * ```
 */
export function analyzeSentiment(text: string): SentimentResult {
  const result = analyzer.analyze(text);
  return {
    score: result.score,
    comparative: result.comparative,
    label: toLabel(result.comparative),
  };
}
