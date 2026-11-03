export type IndianFoodMicronutrientFallback = {
  /** Nutrient amounts per 100 g of the food. Only measured/reported values are included. */
  values: Record<string, number>;
  source: string;
};

const IFCT_SOURCE = 'ICMR-NIN Indian Food Composition Tables 2017 (per 100 g)';

/**
 * Small offline fallback for everyday Indian foods.
 * This intentionally contains only nutrients whose IFCT 2017 entries are known here.
 * Missing keys remain absent instead of being represented as zero.
 */
export function getIndianFoodMicronutrientFallback(query: string): IndianFoodMicronutrientFallback | null {
  const name = query.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name) return null;

  if (/\b(paneer|panner)\b/.test(name)) {
    return { values: { calcium: 476, iron: 0.9 }, source: IFCT_SOURCE };
  }

  if (/\b(buffalo|buffaloe|bhains|bhainsa)\b/.test(name) && /\b(milk|doodh)\b/.test(name)) {
    return { values: { calcium: 121, iron: 0.16 }, source: IFCT_SOURCE };
  }

  if (/\b(milk|doodh)\b/.test(name)) {
    // Plain cow's milk is the generic fallback when the user has not specified buffalo milk.
    return { values: { calcium: 118, iron: 0.15 }, source: IFCT_SOURCE };
  }

  return null;
}
