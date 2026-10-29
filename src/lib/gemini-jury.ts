/**
 * Multi-model Gemini nutrition jury.
 * Five independent estimators are cross-reviewed by a final Gemini judge.
 * This module is intentionally isolated until wired into the food parser route.
 */
export const GEMINI_JURY_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-2.5-pro",
] as const;

export type JuryEstimate = {
  model: string;
  nutrition: Record<string, number | null>;
};

export function median(values: Array<number | null>): number | null {
  const sorted = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0).sort((a,b)=>a-b);
  if (!sorted.length) return null;
  const i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : (sorted[i-1] + sorted[i]) / 2;
}

export function buildConsensus(estimates: JuryEstimate[]): Record<string, number | null> {
  const keys = [...new Set(estimates.flatMap(e => Object.keys(e.nutrition)))];
  return Object.fromEntries(keys.map(key => [key, median(estimates.map(e => e.nutrition[key] ?? null))]));
}

export function getGeminiKeys(): string[] {
  return [...new Set([
    process.env.GEMINI_API_KEY || "",
    ...(process.env.GEMINI_API_KEYS || "").split(/[\n,;]+/),
  ].map(s=>s.trim()).filter(Boolean))].slice(0,7);
}
