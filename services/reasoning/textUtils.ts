// Pure text/math helpers extracted from reasoningAnalyticsService.
// No state, no I/O — safe to import from anywhere.

import type { ReasoningSignal } from '../../types';

export const normalizeWhitespace = (text: string) =>
  text.toLowerCase().replace(/\s+/g, ' ').trim();

export const tokenize = (text: string) =>
  normalizeWhitespace(text)
    .split(/[^a-zA-Z0-9가-힣]+/)
    .filter(token => token.length > 1);

export const countMatches = (text: string, patterns: string[]) =>
  patterns.filter(pattern => text.includes(pattern)).length;

export const clamp = (value: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));

export const shannonEntropy = (values: number[]) =>
  values.reduce((acc, value) => {
    if (value <= 0) return acc;
    return acc - value * Math.log2(value);
  }, 0);

export const average = (values: number[]) =>
  values.length > 0 ? values.reduce((acc, value) => acc + value, 0) / values.length : 0;

export const toSoftmaxMap = <T extends string>(
  scores: Record<T, number>,
  temperature = 1
): Record<T, number> => {
  const entries = Object.entries(scores) as [T, number][];
  const values = entries.map(([, score]) => Math.exp(score * temperature));
  const sum = values.reduce((acc, value) => acc + value, 0) || 1;
  return entries.reduce((acc, [key], index) => {
    acc[key] = values[index] / sum;
    return acc;
  }, {} as Record<T, number>);
};

export const buildSignal = (
  label: string,
  score: number,
  matchedTerms: string[],
  summary: string
): ReasoningSignal => ({
  label,
  score,
  matchedTerms,
  summary,
});

