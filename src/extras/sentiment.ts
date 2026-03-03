/**
 * Optional sentiment analysis. Requires a sentiment library to be installed
 * by the consumer (e.g. natural, sentiment, or similar) and passed in,
 * or use the optional peer dependency.
 */

export type SentimentLabel =
  | "very positive"
  | "positive"
  | "neutral"
  | "negative"
  | "very negative";

export interface SentimentResult {
  score: number;
  label: SentimentLabel;
}

/**
 * Return a simple sentiment score/label for the given text.
 * You must provide an analyzer that returns a polarity in [-1, 1].
 * Example with a hypothetical sentiment package:
 *
 *   import { analyzeSentiment } from "ratemyprofessors-client/extras/sentiment";
 *   const result = analyzeSentiment("Great professor!", (text) => sentiment(text).score);
 */
export function analyzeSentiment(
  text: string,
  getPolarity: (text: string) => number
): SentimentResult {
  const score = getPolarity(text);
  let label: SentimentLabel;
  if (score > 0.5) label = "very positive";
  else if (score > 0.2) label = "positive";
  else if (score < -0.5) label = "very negative";
  else if (score < -0.2) label = "negative";
  else label = "neutral";
  return { score, label };
}
