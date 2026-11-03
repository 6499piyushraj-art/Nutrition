import { NUTRIENT_MAP, USDA_BASE_URL } from './constants';

const USDA_API_KEY = process.env.USDA_API_KEY?.trim() || 'DEMO_KEY';

export interface StrippedFood {
  fdc_id: number;
  description: string;
  brand: string;
  upc: string;
  serving_size: number | null;
  serving_unit: string;
  data_type: string;
  calories: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  fiber_g: number | null;
  nutrient_values?: Record<string, number>;
  nutrient_source?: string;
}

export interface SearchResult {
  query: string;
  total: number;
  results: StrippedFood[];
}

const SEARCH_CACHE = new Map<string, { expiresAt: number; result: SearchResult }>();
const SEARCH_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const FDC_MICRONUTRIENT_MAP: Record<number, { key: string; factor: number }> = {
  1087: { key: 'calcium', factor: 1 }, 1089: { key: 'iron', factor: 1 },
  1095: { key: 'zinc', factor: 1 }, 1114: { key: 'vitamin_d', factor: 1 },
  1178: { key: 'b12', factor: 1 }, 1177: { key: 'folate', factor: 1 }, 1186: { key: 'folate', factor: 1 },
  1162: { key: 'vitamin_c', factor: 1 }, 1106: { key: 'vitamin_a', factor: 1 },
  1100: { key: 'iodine', factor: 1 }, 1091: { key: 'phosphorus', factor: 1 },
  1090: { key: 'magnesium', factor: 1 }, 1092: { key: 'potassium', factor: 1 },
  1098: { key: 'copper', factor: 1000 }, 1101: { key: 'manganese', factor: 1 },
  1103: { key: 'selenium', factor: 1 }, 1109: { key: 'vitamin_e', factor: 1 },
  1120: { key: 'vitamin_k', factor: 1 }, 1165: { key: 'b1', factor: 1 },
  1166: { key: 'b2', factor: 1 }, 1167: { key: 'b3', factor: 1 },
  1170: { key: 'b5', factor: 1 }, 1175: { key: 'b6', factor: 1 },
  1176: { key: 'biotin', factor: 1 },
};

function stripFood(food: Record<string, unknown>): StrippedFood {
  const nutrients: Record<string, number> = {};
  const nutrientValues: Record<string, number> = {};
  const foodNutrients = (food.foodNutrients || []) as Record<string, unknown>[];

  for (const n of foodNutrients) {
    const nested = (n.nutrient || {}) as Record<string, unknown>;
    const nid = (n.nutrientId as number) || (nested.id as number);
    const raw = typeof n.value === 'number' ? n.value : typeof n.amount === 'number' ? n.amount : null;
    if (raw === null || !Number.isFinite(raw)) continue;
    if (nid && nid in NUTRIENT_MAP) nutrients[NUTRIENT_MAP[nid]] = Math.round(raw * 10) / 10;
    if (nid && nid in FDC_MICRONUTRIENT_MAP) {
      const m = FDC_MICRONUTRIENT_MAP[nid];
      nutrientValues[m.key] = Math.round(raw * m.factor * 1000) / 1000;
    }
    const name = String(n.nutrientName || nested.name || '').toLowerCase();
    const unit = String(n.unitName || nested.unitName || '').toLowerCase();
    const grams = unit === 'mg' ? raw / 1000 : unit === 'µg' || unit === 'ug' ? raw / 1000000 : raw;
    // Only accept explicit total omega values; do not infer a total from one fatty acid.
    if (/omega[- ]?3.*total|total.*omega[- ]?3/.test(name)) nutrientValues.omega3 = Math.round(grams * 10000) / 10000;
    if (/omega[- ]?6.*total|total.*omega[- ]?6/.test(name)) nutrientValues.omega6 = Math.round(grams * 10000) / 10000;
  }
  const dataType = String(food.dataType || 'FoodData Central');
  return {
    fdc_id: food.fdcId as number,
    description: (food.description as string) || '',
    brand: (food.brandOwner as string) || (food.brandName as string) || '',
    upc: (food.gtinUpc as string) || '',
    serving_size: (food.servingSize as number) || null,
    serving_unit: (food.servingSizeUnit as string) || '',
    data_type: (food.dataType as string) || '',
    calories: nutrients.calories ?? null,
    protein_g: nutrients.protein_g ?? null,
    fat_g: nutrients.fat_g ?? null,
    carbs_g: nutrients.carbs_g ?? null,
    sugar_g: nutrients.sugar_g ?? null,
    sodium_mg: nutrients.sodium_mg ?? null,
    fiber_g: nutrients.fiber_g ?? null,
    nutrient_values: nutrientValues,
    nutrient_source: 'USDA FoodData Central (' + dataType + ')',
  };
}

export async function searchUSDA(query: string, limit = 10, dataTypes?: string[]): Promise<SearchResult> {
  const types = dataTypes || ['Branded', 'Survey (FNDDS)'];
  const safeQuery = query.trim();
  if (!safeQuery) return { query, total: 0, results: [] };

  const cacheKey = JSON.stringify([safeQuery.toLowerCase(), Math.min(limit, 25), types]);
  const cached = SEARCH_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  if (cached) SEARCH_CACHE.delete(cacheKey);

  const res = await fetch(`${USDA_BASE_URL}/foods/search?api_key=${encodeURIComponent(USDA_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: safeQuery,
      pageSize: Math.min(limit, 25),
      dataType: types,
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`USDA API error: ${res.status}`);
  }

  const data = await res.json();
  const result: SearchResult = {
    query: safeQuery,
    total: data.totalHits || 0,
    results: ((data.foods || []) as Record<string, unknown>[]).map(stripFood),
  };
  if (SEARCH_CACHE.size >= 150) {
    const firstKey = SEARCH_CACHE.keys().next().value;
    if (firstKey) SEARCH_CACHE.delete(firstKey);
  }
  SEARCH_CACHE.set(cacheKey, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, result });
  return result;
}

export async function lookupBarcodeOpenFoodFacts(upc: string): Promise<StrippedFood | null> {
  const res = await fetch(
    `http://world.openfoodfacts.org/api/v2/product/${upc}.json?fields=product_name,brands,serving_size,serving_quantity,nutriments`,
  );

  if (!res.ok) return null;

  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;

  const p = data.product;
  const n = p.nutriments || {};

  return {
    fdc_id: 0,
    description: p.product_name || '',
    brand: p.brands || '',
    upc,
    serving_size: p.serving_quantity || null,
    serving_unit: p.serving_size ? p.serving_size.replace(/[0-9.]+\s*/g, '').trim() || 'g' : 'g',
    data_type: 'OpenFoodFacts',
    calories: typeof (n['energy-kcal_serving'] ?? n['energy-kcal_100g']) === 'number' ? Math.round((n['energy-kcal_serving'] ?? n['energy-kcal_100g']) * 10) / 10 : null,
    protein_g: typeof (n.proteins_serving ?? n.proteins_100g) === 'number' ? Math.round((n.proteins_serving ?? n.proteins_100g) * 10) / 10 : null,
    fat_g: typeof (n.fat_serving ?? n.fat_100g) === 'number' ? Math.round((n.fat_serving ?? n.fat_100g) * 10) / 10 : null,
    carbs_g: typeof (n.carbohydrates_serving ?? n.carbohydrates_100g) === 'number' ? Math.round((n.carbohydrates_serving ?? n.carbohydrates_100g) * 10) / 10 : null,
    sugar_g: typeof (n.sugars_serving ?? n.sugars_100g) === 'number' ? Math.round((n.sugars_serving ?? n.sugars_100g) * 10) / 10 : null,
    sodium_mg: typeof (n.sodium_serving ?? n.sodium_100g) === 'number' ? Math.round((n.sodium_serving ?? n.sodium_100g) * 1000 * 10) / 10 : null,
    fiber_g: typeof (n.fiber_serving ?? n.fiber_100g) === 'number' ? Math.round((n.fiber_serving ?? n.fiber_100g) * 10) / 10 : null,
    nutrient_values: {},
    nutrient_source: 'Open Food Facts',
  };
}

export async function lookupBarcode(upc: string): Promise<{ food: StrippedFood; source: string } | null> {
  if (process.env.FATSECRET_CLIENT_ID) {
    const { lookupBarcodeFatSecret } = await import('./fatsecret');
    const fs = await lookupBarcodeFatSecret(upc);
    if (fs) return { food: fs, source: 'FatSecret' };
  }

  const off = await lookupBarcodeOpenFoodFacts(upc);
  if (off) return { food: off, source: 'Open Food Facts' };

  return null;
}
