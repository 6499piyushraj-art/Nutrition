import { createHash } from 'node:crypto';

// Seven text+image-capable Gemini API models, ordered by preferred fallback.
export const GEMINI_JURY_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
] as const;

type JsonObject = Record<string, unknown>;
type Candidate = { model: string; json: JsonObject; attemptedModels: string[] };
const NUTRIENT_KEYS = [
  'omega3', 'calcium', 'iron', 'zinc', 'vitamin_d',
  'b12', 'folate', 'vitamin_c', 'vitamin_a', 'iodine',
] as const;
const NUMERIC_FIELDS = [
  'default_serving_size', 'energy_kcal', 'protein_g', 'fat_g',
  'saturated_fat_g', 'carbs_g', 'fiber_g', 'sugar_g',
  'sodium_mg', 'cholesterol_mg',
] as const;
const cache = new Map<string, { result: JsonObject; at: number }>();

function splitValues(value: string | undefined): string[] {
  return (value || '').split(',').flatMap((part) => part.split(';')).flatMap((part) => part.split(String.fromCharCode(10)));
}

function positiveIntEnv(name: string, fallback: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function cacheTtlMs(): number {
  return positiveIntEnv('GEMINI_CACHE_TTL_DAYS', 30, 365) * 24 * 60 * 60 * 1000;
}

function keys(): string[] {
  return [...new Set([
    process.env.GEMINI_API_KEY || '',
    ...splitValues(process.env.GEMINI_API_KEYS),
  ].map((value) => value.trim()).filter(Boolean))].slice(0, 7);
}

function models(): string[] {
  return [...new Set([
    process.env.GEMINI_MODEL || '',
    ...splitValues(process.env.GEMINI_FAILOVER_MODELS),
    ...GEMINI_JURY_MODELS,
  ].map((value) => {
    const trimmed = value.trim();
    return trimmed.startsWith('models/') ? trimmed.slice(7) : trimmed;
  }).filter(Boolean))].slice(0, 7);
}

function parseJsonObject(input: string): JsonObject {
  let cleaned = input.trim();
  const fence = String.fromCharCode(96, 96, 96);
  if (cleaned.startsWith(fence)) {
    cleaned = cleaned.slice(3).trim();
    if (cleaned.slice(0, 4).toLowerCase() === 'json') cleaned = cleaned.slice(4).trim();
    if (cleaned.endsWith(fence)) cleaned = cleaned.slice(0, -3).trim();
  }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);
  const parsed: unknown = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Gemini returned an invalid JSON object.');
  }
  return parsed as JsonObject;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function median(values: Array<number | null>): number | null {
  const sorted = values.filter((value): value is number => value !== null).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeFood(source: JsonObject, fallback?: JsonObject): JsonObject {
  const base = fallback || {};
  const food: JsonObject = {
    description: textOrNull(source.description) || textOrNull(base.description) || 'Food entry',
    brand_name: textOrNull(source.brand_name) || textOrNull(base.brand_name),
    default_serving_size: numberOrNull(source.default_serving_size) ?? numberOrNull(base.default_serving_size),
    default_serving_unit: textOrNull(source.default_serving_unit) || textOrNull(base.default_serving_unit) || 'g',
    energy_kcal: numberOrNull(source.energy_kcal) ?? numberOrNull(base.energy_kcal),
    protein_g: numberOrNull(source.protein_g) ?? numberOrNull(base.protein_g),
    fat_g: numberOrNull(source.fat_g) ?? numberOrNull(base.fat_g),
    saturated_fat_g: numberOrNull(source.saturated_fat_g) ?? numberOrNull(base.saturated_fat_g),
    carbs_g: numberOrNull(source.carbs_g) ?? numberOrNull(base.carbs_g),
    fiber_g: numberOrNull(source.fiber_g) ?? numberOrNull(base.fiber_g),
    sugar_g: numberOrNull(source.sugar_g) ?? numberOrNull(base.sugar_g),
    sodium_mg: numberOrNull(source.sodium_mg) ?? numberOrNull(base.sodium_mg),
    cholesterol_mg: numberOrNull(source.cholesterol_mg) ?? numberOrNull(base.cholesterol_mg),
  };
  const sourceValues = source.nutrient_values && typeof source.nutrient_values === 'object' && !Array.isArray(source.nutrient_values)
    ? source.nutrient_values as JsonObject : {};
  const fallbackValues = base.nutrient_values && typeof base.nutrient_values === 'object' && !Array.isArray(base.nutrient_values)
    ? base.nutrient_values as JsonObject : {};
  food.nutrient_values = Object.fromEntries(NUTRIENT_KEYS.map((key) => [
    key,
    numberOrNull(sourceValues[key]) ?? numberOrNull(fallbackValues[key]),
  ]));
  food.nutrient_source = 'Gemini multi-estimate jury and judge; approximate, not lab-tested';
  return food;
}

function consensus(rows: JsonObject[]): JsonObject {
  const first = rows[0] || {};
  const out: JsonObject = {
    description: textOrNull(first.description) || 'Food entry',
    brand_name: textOrNull(first.brand_name),
    default_serving_unit: textOrNull(first.default_serving_unit) || 'g',
  };
  for (const field of NUMERIC_FIELDS) {
    out[field] = median(rows.map((row) => numberOrNull(row[field])));
  }
  const nutrientRows = rows.map((row) => (
    row.nutrient_values && typeof row.nutrient_values === 'object' && !Array.isArray(row.nutrient_values)
      ? row.nutrient_values as JsonObject : {}
  ));
  out.nutrient_values = Object.fromEntries(NUTRIENT_KEYS.map((key) => [
    key,
    median(nutrientRows.map((row) => numberOrNull(row[key]))),
  ]));
  return out;
}

async function callGemini(
  parts: Array<Record<string, unknown>>,
  systemPrompt: string,
  offset: number,
): Promise<Candidate> {
  const apiKeys = keys();
  const availableModels = models();
  if (apiKeys.length === 0) throw new Error('GEMINI_API_KEY is missing');
  if (availableModels.length === 0) throw new Error('No Gemini models configured');

  let lastError = 'Gemini request failed';
  const attemptedModels: string[] = [];
  // Try every configured key for a model before advancing to the next model.
  for (let modelOffset = 0; modelOffset < availableModels.length; modelOffset += 1) {
    const model = availableModels[(offset + modelOffset) % availableModels.length];
    attemptedModels.push(model);
    for (let keyOffset = 0; keyOffset < apiKeys.length; keyOffset += 1) {
      const apiKey = apiKeys[(offset + keyOffset) % apiKeys.length];
      try {
        const response = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/' +
            encodeURIComponent(model) + ':generateContent',
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            signal: AbortSignal.timeout(12000),
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemPrompt }] },
              contents: [{ parts }],
              generationConfig: {
                temperature: 0.15,
                maxOutputTokens: 1600,
                responseMimeType: 'application/json',
              },
            }),
          },
        );

        if (!response.ok) {
          const detail = await response.json().catch(() => null) as { error?: { message?: string } } | null;
          lastError = model + ' returned HTTP ' + response.status +
            (detail?.error?.message ? ': ' + detail.error.message : '');
          continue;
        }

        const data = await response.json() as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const output = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
        if (!output) {
          lastError = model + ' returned no text';
          continue;
        }
        return { model, json: parseJsonObject(output), attemptedModels: [...attemptedModels] };
      } catch (error) {
        lastError = error instanceof Error ? error.message : model + ' failed';
      }
    }
  }
  throw new Error(lastError);
}

const NUTRITION_PROMPT = [
  'You are one independent nutrition estimator in MyNutri AI.',
  'Estimate the complete food log portion, not automatically per 100 g.',
  'Understand Hindi, Hinglish, Indian foods, recipes and household measures.',
  'For plain cow milk, calcium is about 110-125 mg per 100 g; scale to the logged portion.',
  'Do not apply cow-milk values to plant milk, chai, milkshake or flavoured milk.',
  'Do not invent foods, quantities, brands, or fortification.',
  'Return a single JSON object with these exact keys:',
  'description, brand_name, default_serving_size, default_serving_unit, energy_kcal, protein_g, fat_g, saturated_fat_g, carbs_g, fiber_g, sugar_g, sodium_mg, cholesterol_mg, nutrient_values, nutrient_source.',
  'nutrient_values must use these exact keys: omega3, calcium, iron, zinc, vitamin_d, b12, folate, vitamin_c, vitamin_a, iodine.',
  'Units: omega3 in g; calcium, iron, zinc, vitamin_c in mg; vitamin_d, b12, folate, vitamin_a and iodine in micrograms; macros in g; energy in kcal; sodium and cholesterol in mg.',
  'Estimate all ten micronutrients for identifiable common foods. Do not use null only because no nutrition label is present.',
  'Use zero for a nutrient that is reasonably absent; use null only when truly not estimable. Never use negative numbers.',
  'Estimate totals for all foods in a multi-food log, keeping units and portions consistent.',
  'Set nutrient_source to Gemini AI estimate. JSON only, no markdown.',
].join(' ');

export async function runGeminiNutritionJury(
  input: { type: string; content: string; mediaType?: string; context?: string },
): Promise<{ food: JsonObject; cached: boolean }> {
  const availableModels = models();
  const estimatorCount = Math.max(2, positiveIntEnv('GEMINI_JURY_ESTIMATORS', 5, 5));
  const hash = createHash('sha256').update(JSON.stringify([
    input.type, input.content, input.mediaType || '', input.context || '', availableModels, estimatorCount,
  ])).digest('hex');

  const prior = cache.get(hash);
  if (prior && Date.now() - prior.at < cacheTtlMs()) {
    return {
      food: {
        ...prior.result,
        jury: { ...((prior.result.jury || {}) as JsonObject), cached: true },
      },
      cached: true,
    };
  }

  const parts: Array<Record<string, unknown>> = input.type === 'image'
    ? [
        { inline_data: { mime_type: input.mediaType || 'image/jpeg', data: input.content } },
        { text: 'Food context: ' + (input.context || 'Identify the food and estimate visible portion.') },
      ]
    : [{ text: 'User food log: ' + input.content }];

  const roles = [
    'Estimate the portion and macronutrients independently.',
    'Focus on micronutrient amounts and ensure all nutrient units are correct.',
    'Focus on Indian food composition and realistic household serving sizes.',
    'Check nutrition plausibility and macro-calorie consistency.',
    'Independently estimate all values and identify uncertainty.',
  ];

  const activeRoles = roles.slice(0, estimatorCount);
  const estimators = await Promise.all(activeRoles.map(async (role, index) => {
    try {
      const candidate = await callGemini(
        [...parts, { text: 'Estimator role: ' + role + ' Do not see or rely on other estimates.' }],
        NUTRITION_PROMPT,
        index,
      );
      return candidate;
    } catch {
      return null;
    }
  }));

  const successful = estimators.filter((item): item is Candidate => item !== null);
  if (successful.length < 2) {
    throw new Error('At least two Gemini estimates were unavailable. Check model access, API key and quota.');
  }

  const baseline = consensus(successful.map((candidate) => candidate.json));
  let finalSource: JsonObject = baseline;
  let judgeModel: string | null = null;
  let judgeAttemptedModels: string[] = [];
  let reviewSummary = 'Median consensus used because the judge was unavailable.';
  let agreement = 'medium';

  try {
    const judge = await callGemini(
      [
        ...parts,
        {
          text: 'Compare these independent estimates field by field. Reject implausible outliers, check serving size, and return the best-supported single JSON object using the exact nutrition keys from the instructions. Do not invent information. Estimates: ' +
            JSON.stringify(successful.map((candidate) => ({ model: candidate.model, estimate: candidate.json }))) +
            ' Median fallback estimate: ' + JSON.stringify(baseline) +
            ' Add review_summary and agreement (high, medium or low).',
        },
      ],
      NUTRITION_PROMPT + ' You are also the independent judge; inspect estimates critically and select plausible values.',
      activeRoles.length,
    );
    finalSource = judge.json;
    judgeModel = judge.model;
    judgeAttemptedModels = judge.attemptedModels;
    reviewSummary = textOrNull(judge.json.review_summary) || 'Compared independent estimates and checked for outliers.';
    const reportedAgreement = textOrNull(judge.json.agreement);
    agreement = reportedAgreement && ['high', 'medium', 'low'].includes(reportedAgreement.toLowerCase())
      ? reportedAgreement.toLowerCase() : 'medium';
  } catch {
    // Use the numeric median fallback when judging fails.
  }

  const food = normalizeFood(finalSource, baseline);
  food.jury = {
    requestedEstimators: estimatorCount,
    estimatorsCompared: successful.length,
    estimatorModels: successful.map((candidate) => candidate.model),
    estimatorRuns: successful.map((candidate) => ({
      successfulModel: candidate.model,
      attemptedModels: candidate.attemptedModels,
      failoverUsed: candidate.attemptedModels.length > 1,
    })),
    judgeModel,
    judgeAttemptedModels,
    judgeFailoverUsed: judgeAttemptedModels.length > 1,
    agreement,
    reviewSummary,
    cached: false,
  };

  if (cache.size >= 500) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(hash, { result: food, at: Date.now() });
  return { food, cached: false };
}
