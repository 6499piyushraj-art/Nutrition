import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getProvider } from '@/lib/ai-providers';
import { checkRateLimit } from '@/lib/rate-limit';
import { searchUSDA, type StrippedFood } from '@/lib/usda';
import { getIndianFoodMicronutrientFallback } from '@/lib/indian-food-fallback';

const AI_DAILY_LIMIT = 50;
const AI_WINDOW_MS = 24 * 60 * 60 * 1000;

const SYSTEM_PROMPT = `You are a nutrition data extraction assistant for a food diary.
The user may write in Hindi, Hinglish, or English, and may list one food or several foods with portions in one message.
Understand Indian foods and household measures such as roti, katori, glass, cup, spoon, poha, dal, sabzi, paratha, idli, dosa, and chai.
If multiple foods are listed, treat the input as one complete food log: estimate each listed portion and ADD their nutrients together. Return one combined entry and totals for the entire message, not only the first food.
Use the quantities and serving sizes the user wrote. If a quantity is not stated, use a common realistic portion and clearly reflect the portion in the description.
Preserve the food names and language from the user's message in the description so they can recognise what they logged.

Return ONLY valid JSON with these fields:
{
  "description": "Concise description of all foods and quantities in this log, preserving the user's wording",
  "brand_name": "Brand if applicable, null otherwise",
  "default_serving_size": number or null,
  "default_serving_unit": "g, ml, cup, piece, bowl, katori, meal, etc.",
  "energy_kcal": number or null,
  "protein_g": number or null,
  "fat_g": number (total fat) or null,
  "saturated_fat_g": number or null,
  "carbs_g": number (total carbohydrates) or null,
  "fiber_g": number or null,
  "sugar_g": number or null,
  "sodium_mg": number or null,
  "cholesterol_mg": number or null,
  "items": [
    {
      "name": "concise canonical English food name for matching in a food-composition database",
      "amount_g": total grams of this food in the entire log, or null if not reasonably known
    }
  ],
  "nutrient_values": {
    "omega3": number or null,
    "calcium": number or null,
    "iron": number or null,
    "zinc": number or null,
    "vitamin_d": number or null,
    "b12": number or null,
    "folate": number or null,
    "vitamin_c": number or null,
    "vitamin_a": number or null,
    "iodine": number or null
  },
  "nutrient_source": "user-provided nutrition label/data" or null
}

Rules:
- These values are estimates for the TOTAL amount in the complete log; combine all listed foods and quantities.
- For homemade food, use typical cooked Indian food values and reasonable portions. Do not treat a katori or roti as 1 gram.
- In items, list each distinct food actually included in this log (maximum 8); translate Hindi/Hinglish food names into a simple English database lookup name, while preserving the user's wording in description. Include the total gram amount eaten for that item when it can be reasonably estimated. For liquids, estimate the equivalent grams from the stated volume; never include serving quantities in the item name.
- The items list is used to look up measured food-composition data. Do not add ingredients the user did not mention. If a multi-food log has uncertain portion sizes, use null rather than inventing an exact weight.
- For nutrition labels or nutrition data explicitly supplied in the user's text/image, extract only values that are actually shown. Do not calculate missing micronutrients.
- The fields in nutrient_values are NOT general AI estimates. Fill them only when the supplied label/table/text explicitly gives their values. For ordinary food descriptions or a food photo without quantified nutrition information, return null for every nutrient_values field.
- Never use 0 to mean unknown. Keep unavailable values null. Do not infer micronutrients from memory or invent precision.
- Use these units in nutrient_values: omega3 in g; calcium, iron, zinc and vitamin_c in mg; vitamin_d, b12, folate, vitamin_a and iodine in µg. Preserve a value only when its unit can be read or safely converted from the supplied data.
- Set nutrient_source to "User-provided nutrition label/data" only when extracting explicitly supplied nutrition information; otherwise return null.
- Do NOT include tags; the user manages tags manually.
- Return ONLY the JSON object, no markdown fences and no explanation.`;


const SELECTED_MICRONUTRIENTS = [
  'omega3', 'calcium', 'iron', 'zinc', 'vitamin_d',
  'b12', 'folate', 'vitamin_c', 'vitamin_a', 'iodine',
] as const;

type FoodComponent = { name: string; amount_g: number | null };

function inputContainsExplicitNutrientData(type: string, content: unknown, context: unknown): boolean {
  if (type === 'image') {
    return /nutrition\s*(?:facts|label|table)|food\s*label/i.test(typeof context === 'string' ? context : '');
  }
  const text = typeof content === 'string' ? content.toLowerCase() : '';
  const nutrientNames = '(?:calcium|iron|zinc|vitamin\\s*d|vitamin\\s*b\\s*-?\\s*12|b12|folate|vitamin\\s*c|vitamin\\s*a|iodine)';
  return new RegExp(nutrientNames + '\\s*[:=]?\\s*\\d', 'i').test(text)
    || new RegExp('\\d+(?:[.,]\\d+)?\\s*(?:mg|mcg|µg|ug)\\s+(?:of\\s*)?' + nutrientNames, 'i').test(text);
}

function finiteNonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function cleanFoodQuery(value: string): string {
  return value
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|kgs|g|gram(?:s)?|ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|cups?|glasses?|katoris?|bowls?|pieces?|slices?)\b/gi, ' ')
    .replace(/\b\d+(?:[.,]\d+)?\s*x\s*/gi, ' ')
    .replace(/[\(\)\[\]\{\}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function finiteNonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function amountFromServing(size: unknown, unitValue: unknown): number | null {
  const sizeNumber = finiteNonNegative(size);
  if (sizeNumber === null || sizeNumber <= 0) return null;
  const unit = typeof unitValue === 'string' ? unitValue.toLowerCase().trim() : '';
  if (/^(kg|kilograms?)$/.test(unit)) return sizeNumber * 1000;
  if (/^(g|gram|grams)$/.test(unit)) return sizeNumber;
  if (/^(ml|millilit(?:er|re)s?)$/.test(unit)) return sizeNumber;
  if (/^(l|lit(?:er|re)s?)$/.test(unit)) return sizeNumber * 1000;
  return null;
}

function explicitGramsFromText(text: string): number | null {
  const matches = Array.from(text.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|kgs|g|grams?|ml|millilit(?:er|re)s?|l|lit(?:er|re)s?)\b/gi));
  if (matches.length !== 1) return null;
  const amount = Number(matches[0][1].replace(',', '.'));
  const unit = matches[0][2].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) return null;
  if (/^(kg|kgs)$/.test(unit)) return amount * 1000;
  if (/^(l|liters?|litres?)$/.test(unit)) return amount * 1000;
  return amount; // For milk-like liquids, 1 ml is approximately 1 g.
}

function parseComponents(rawItems: unknown, rawFood: Record<string, unknown>, userText: string): FoodComponent[] {
  const explicitAmount = explicitGramsFromText(userText);
  if (Array.isArray(rawItems)) {
    const parsed = rawItems.slice(0, 8).map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const name = typeof row.name === 'string' ? cleanFoodQuery(row.name) : '';
      const amount = finiteNonNegative(row.amount_g);
      if (!name || name.length < 2) return null;
      return { name, amount_g: amount !== null && amount > 0 && amount <= 10000 ? amount : null };
    }).filter((item): item is FoodComponent => item !== null);
    if (parsed.length) {
      if (parsed.length === 1) {
        parsed[0].amount_g = explicitAmount ?? parsed[0].amount_g
          ?? amountFromServing(rawFood.default_serving_size, rawFood.default_serving_unit);
      }
      return parsed;
    }
  }

  // Compatibility fallback for older model outputs: only look up a clearly single-food description.
  const description = typeof rawFood.description === 'string' ? rawFood.description : '';
  if (!description || /[,;+]|\b(?:and|with|plus|aur|or)\b/i.test(description)) return [];
  const name = cleanFoodQuery(description);
  const amount = explicitAmount ?? amountFromServing(rawFood.default_serving_size, rawFood.default_serving_unit);
  return name ? [{ name, amount_g: amount }] : [];
}

function candidateScore(query: string, food: StrippedFood): number {
  const normalizeTokens = (text: string) => cleanFoodQuery(text.toLowerCase())
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !['and', 'with', 'raw', 'fresh', 'food'].includes(token));
  const queryTokens = Array.from(new Set(normalizeTokens(query)));
  const foodTokens = new Set(normalizeTokens(food.description));
  const matches = queryTokens.filter((token) => foodTokens.has(token)).length;
  const relevance = queryTokens.length ? matches / queryTokens.length : 0;
  const coverage = SELECTED_MICRONUTRIENTS.filter((key) => {
    const value = food.nutrient_values?.[key];
    return typeof value === 'number' && Number.isFinite(value);
  }).length;
  const type = food.data_type.toLowerCase();
  const typeBonus = type.includes('sr legacy') ? 0.6 : type.includes('foundation') ? 0.5 : type.includes('fndds') ? 0.3 : 0;
  return relevance * 10 + coverage * 0.25 + typeBonus;
}

async function lookupFoodMicronutrients(components: FoodComponent[]): Promise<{
  values: Record<string, number>;
  sources: string[];
}> {
  const totals: Record<string, number> = {};
  const covered = Object.fromEntries(SELECTED_MICRONUTRIENTS.map((key) => [key, true])) as Record<(typeof SELECTED_MICRONUTRIENTS)[number], boolean>;
  const sources = new Set<string>();

  if (!components.length || components.length > 8 || components.some((item) => item.amount_g === null || item.amount_g <= 0)) {
    return { values: {}, sources: [] };
  }

  const matches = await Promise.all(components.map(async (component) => {
    try {
      const result = await searchUSDA(component.name, 8, ['Foundation', 'SR Legacy', 'Survey (FNDDS)']);
      const candidates = result.results
        .filter((food) => SELECTED_MICRONUTRIENTS.some((key) => typeof food.nutrient_values?.[key] === 'number'))
        .sort((a, b) => candidateScore(component.name, b) - candidateScore(component.name, a));
      const best = candidates[0];
      if (!best || candidateScore(component.name, best) < 5) return null;
      return best;
    } catch {
      // The offline Indian-food reference below still provides known values if the public API is unavailable.
      return null;
    }
  }));

  for (let index = 0; index < components.length; index++) {
    const component = components[index];
    const match = matches[index];
    const fallback = getIndianFoodMicronutrientFallback(component.name);
    if (match?.nutrient_source) sources.add(match.nutrient_source);
    if (fallback) sources.add(fallback.source);
    const factor = (component.amount_g as number) / 100;

    for (const key of SELECTED_MICRONUTRIENTS) {
      // Prefer the selected food's online composition record; fill only genuinely missing entries from IFCT.
      const databaseValue = finiteNonNegative(match?.nutrient_values?.[key]);
      const fallbackValue = finiteNonNegative(fallback?.values[key]);
      const per100g = databaseValue ?? fallbackValue;
      if (per100g === null) {
        covered[key] = false;
      } else {
        totals[key] = (totals[key] || 0) + per100g * factor;
      }
    }
  }

  const values: Record<string, number> = {};
  for (const key of SELECTED_MICRONUTRIENTS) {
    if (covered[key] && typeof totals[key] === 'number') {
      values[key] = Math.round(totals[key] * 1000) / 1000;
    }
  }
  return { values, sources: Array.from(sources) };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { allowed, retryAfterMs } = checkRateLimit(`ai:${session.user.id}`, AI_DAILY_LIMIT, AI_WINDOW_MS);
  if (!allowed) {
    const hours = Math.ceil(retryAfterMs / (1000 * 60 * 60));
    return NextResponse.json(
      { error: `Daily AI limit reached (${AI_DAILY_LIMIT} requests). Try again in ~${hours} hour${hours > 1 ? 's' : ''}.` },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } },
    );
  }

  try {
    const body = await request.json();
    const { type, content, mediaType, context } = body;

    if (!type || !content) {
      return NextResponse.json({ error: 'Missing type or content' }, { status: 400 });
    }

    let rawResponse: string;

    if (type === 'text') {
      const provider = getProvider('text');
      rawResponse = await provider.parseText(
        'This is the complete food-log input. Understand Hindi, Hinglish, or English and estimate combined nutrition for every food and portion listed below. Input:\n\n' + content,
        SYSTEM_PROMPT,
      );
    } else if (type === 'image') {
      if (!mediaType) {
        return NextResponse.json({ error: 'Missing mediaType for image' }, { status: 400 });
      }
      const provider = getProvider('vision');
      if (!provider.parseImage) {
        return NextResponse.json({ error: 'No vision-capable AI provider configured' }, { status: 503 });
      }
      const userPrompt = context
        ? `Extract nutrition information from this image. Context: ${context}`
        : 'Extract nutrition information from this image. If this is a nutrition label, read the exact values. If this is a photo of food, identify the food and estimate nutrition.';
      rawResponse = await provider.parseImage(content, mediaType, SYSTEM_PROMPT, userPrompt);
    } else {
      return NextResponse.json({ error: 'Invalid type. Use "text" or "image"' }, { status: 400 });
    }

    // Clean up response — strip markdown fences if present
    let cleaned = rawResponse.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const rawFood = JSON.parse(cleaned) as Record<string, unknown>;
    const rawNutrients = rawFood.nutrient_values && typeof rawFood.nutrient_values === 'object' && !Array.isArray(rawFood.nutrient_values)
      ? rawFood.nutrient_values as Record<string, unknown>
      : {};
    const explicitValues: Record<string, number> = {};
    if (inputContainsExplicitNutrientData(String(type), content, context)) {
      for (const key of SELECTED_MICRONUTRIENTS) {
        const value = finiteNonNegative(rawNutrients[key]);
        if (value !== null) explicitValues[key] = value;
      }
    }

    let databaseValues: Record<string, number> = {};
    let databaseSources: string[] = [];
    const components = type === 'text' ? parseComponents(rawFood.items, rawFood, String(content)) : [];
    if (components.length) {
      const result = await lookupFoodMicronutrients(components);
      databaseValues = result.values;
      databaseSources = result.sources;
    }

    // Values explicitly read from the user's label take precedence over generic food matches.
    const finalNutrients = { ...databaseValues, ...explicitValues };
    const explicitSource = typeof rawFood.nutrient_source === 'string' && rawFood.nutrient_source.trim()
      ? rawFood.nutrient_source.trim()
      : null;
    const nutrientSource = databaseSources.length
      ? `USDA FoodData Central (${databaseSources.join(', ')}) for available micronutrients; Gemini estimate for macros/portions${explicitSource ? `; supplied label values also used (${explicitSource})` : ''}`
      : explicitSource;
    return NextResponse.json({
      food: { ...rawFood, nutrient_values: finalNutrients, nutrient_source: nutrientSource },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('No AI provider')) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    if (message.includes('JSON') || message.includes('Unexpected token')) {
      return NextResponse.json({ error: 'AI returned invalid data. Try again or enter manually.' }, { status: 502 });
    }
    return NextResponse.json({ error: `AI parsing failed: ${message}` }, { status: 502 });
  }
}
