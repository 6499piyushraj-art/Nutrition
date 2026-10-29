import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getProvider } from '@/lib/ai-providers';
import { checkRateLimit } from '@/lib/rate-limit';

const AI_DAILY_LIMIT = 50;
const AI_WINDOW_MS = 24 * 60 * 60 * 1000;

const NUTRIENT_KEYS = [
  'omega3', 'calcium', 'iron', 'zinc', 'vitamin_d',
  'b12', 'folate', 'vitamin_c', 'vitamin_a', 'iodine',
] as const;

const SYSTEM_PROMPT = `You are MyNutri AI, a careful nutrition estimator. Use your own Gemini nutrition knowledge to estimate ALL nutrition for the foods the user logs. Do not call or claim to have used USDA, IFCT, Open Food Facts, another database, or another AI provider. Every value in the response must come from Gemini's estimate or from a label/image the user supplied.

The user may write Hindi, Hinglish, or English and may list one or multiple foods with amounts. Understand Indian home foods, e.g. doodh/milk, dahi/curd, roti/chapati, dal, chawal/rice, sabzi, poha, idli, dosa, egg/anda, banana/kela, paneer, nuts and chai. Preserve the user's food wording in the description.

Estimate the total nutrition for the ENTIRE portion described, not per 100 g unless the user logged 100 g. Use realistic food-specific composition knowledge, with reasonable portions for household measures. If the user writes "Milk 100g", estimate values for 100 g milk. For plain cow milk, calcium is roughly around 110-125 mg per 100 g; do not leave milk calcium unavailable merely because no nutrition label was supplied. Do not apply cow-milk values to plant milk, flavoured milk, tea, or milkshake.

Return ONLY valid JSON with exactly these fields:
{
  "description": "concise description of all foods and quantities in the log",
  "brand_name": null,
  "default_serving_size": number,
  "default_serving_unit": "g, ml, cup, piece, bowl, katori, meal, etc.",
  "energy_kcal": number or null,
  "protein_g": number or null,
  "fat_g": number or null,
  "saturated_fat_g": number or null,
  "carbs_g": number or null,
  "fiber_g": number or null,
  "sugar_g": number or null,
  "sodium_mg": number or null,
  "cholesterol_mg": number or null,
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
  "nutrient_source": "Gemini AI estimate"
}

Nutrient units are fixed:
- omega3: grams (g)
- calcium, iron, zinc, vitamin_c: milligrams (mg)
- vitamin_d, b12, folate, vitamin_a, iodine: micrograms (µg). Vitamin A should be µg RAE where appropriate; vitamin D must be µg, not IU.
- Energy: kcal; protein/carbohydrate/fat/fiber: grams; sodium/cholesterol: mg.

Critical nutrient rules:
- Return numeric estimates for all ten nutrient_values fields for common, identifiable foods, including micronutrients. Do NOT set them all to null just because a nutrition label was not supplied.
- If a food naturally provides effectively none of a nutrient (e.g. B12 in ordinary unfortified plant foods), use 0 when this is a reasonable nutrition estimate. Use null only if the food or portion genuinely cannot be identified well enough to estimate. Never use null as a generic "label not provided" value.
- Estimate nutrient values for the total portion the user ate. Convert from per-100-g mental/reference values to the actual amount where necessary.
- For multiple foods, estimate each listed item and add the amounts together. Do not only estimate the first item.
- If the food type or amount is ambiguous, choose a clearly reasonable estimate and make the portion description explicit instead of refusing to estimate.
- If exact nutrition values are visible on a provided nutrition label, prefer those exact label values for the nutrients visible and use Gemini's food-composition estimate for the remaining nutrients. Never pretend an estimated value was read from the label.
- Keep quantities and units internally consistent. Do not return negative values, strings such as "trace", percent daily values, or units inside numeric fields.
- Keep the macro estimate and micronutrient estimate consistent with the same food and portion.
- Do not add foods or ingredients the user did not mention.
- Return valid JSON only, with no markdown fences, comments, or explanation.`;

const MICRONUTRIENT_COMPLETION_PROMPT = `You are Gemini powering MyNutri AI. Estimate only from your own food-composition knowledge and the user's supplied food description; do not use or claim an external database. Complete all ten selected nutrient estimates for the ENTIRE described portion. These are the units: omega3 g; calcium, iron, zinc, vitamin_c mg; vitamin_d, b12, folate, vitamin_a, iodine µg. For common identifiable foods, do not leave values null merely because a label is absent; use a reasonable estimate. For plain cow milk, calcium should be approximately 110-125 mg per 100 g. Use 0 when the food reasonably contains effectively none; use null only if genuinely impossible to estimate. Do not invent foods. Return only JSON in this shape: {"nutrient_values":{"omega3":number|null,"calcium":number|null,"iron":number|null,"zinc":number|null,"vitamin_d":number|null,"b12":number|null,"folate":number|null,"vitamin_c":number|null,"vitamin_a":number|null,"iodine":number|null}}.`;

function parseJsonObject(text: string): Record<string, unknown> {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  const parsed: unknown = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Gemini returned an invalid JSON object.');
  }
  return parsed as Record<string, unknown>;
}

function finiteNonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizeNutrients(value: unknown): Record<(typeof NUTRIENT_KEYS)[number], number | null> {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const normalized = Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, finiteNonNegative(source[key])]));
  return normalized as Record<(typeof NUTRIENT_KEYS)[number], number | null>;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: 'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Render Environment.' },
      { status: 503 },
    );
  }

  const { allowed, retryAfterMs } = checkRateLimit(`ai:${session.user.id}`, AI_DAILY_LIMIT, AI_WINDOW_MS);
  if (!allowed) {
    const hours = Math.ceil(retryAfterMs / (1000 * 60 * 60));
    return NextResponse.json(
      { error: `Daily Gemini limit reached (${AI_DAILY_LIMIT} requests). Try again in ~${hours} hour${hours > 1 ? 's' : ''}.` },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } },
    );
  }

  try {
    const body = await request.json();
    const { type, content, mediaType, context } = body;
    if (!type || !content) {
      return NextResponse.json({ error: 'Missing type or content' }, { status: 400 });
    }

    // getProvider prefers Gemini when GEMINI_API_KEY is set; reject any fallback provider.
    let provider = getProvider(type === 'image' ? 'vision' : 'text');
    if (provider.name !== 'gemini') {
      return NextResponse.json({ error: 'Food nutrition estimates must run through Gemini. Check GEMINI_API_KEY.' }, { status: 503 });
    }

    let rawResponse: string;
    if (type === 'text') {
      rawResponse = await provider.parseText(
        'Estimate the complete nutrition for this entire log in the quantities described. Input:\n\n' + String(content),
        SYSTEM_PROMPT,
      );
    } else if (type === 'image') {
      if (!mediaType || !provider.parseImage) {
        return NextResponse.json({ error: 'Gemini image parsing requires an image media type.' }, { status: 400 });
      }
      const userPrompt = context
        ? 'Read a nutrition label accurately if this is a label. If it is a normal food photo, identify the visible food and estimate all nutrients for a reasonable visible portion. Context: ' + String(context)
        : 'If this is a nutrition label, extract its visible values. Otherwise identify the food and estimate all macros and essential micronutrients for the pictured portion using your nutrition knowledge.';
      rawResponse = await provider.parseImage(String(content), String(mediaType), SYSTEM_PROMPT, userPrompt);
    } else {
      return NextResponse.json({ error: 'Invalid type. Use "text" or "image".' }, { status: 400 });
    }

    const rawFood = parseJsonObject(rawResponse);
    let nutrientValues = normalizeNutrients(rawFood.nutrient_values);

    // If Gemini omitted fields, ask Gemini once more to fill gaps based on the same food and portion.
    // No USDA/IFCT/Open Food Facts or second AI provider is used.
    if (NUTRIENT_KEYS.some((key) => nutrientValues[key] === null)) {
      try {
        const completion = await provider.parseText(
          'Food log supplied by the user:\n' + String(type === 'text' ? content : context || 'Food photo') +
          '\nGemini parsed food and portion:\n' + JSON.stringify({
            description: rawFood.description,
            serving_size: rawFood.default_serving_size,
            serving_unit: rawFood.default_serving_unit,
            energy_kcal: rawFood.energy_kcal,
            protein_g: rawFood.protein_g,
            fat_g: rawFood.fat_g,
            carbs_g: rawFood.carbs_g,
            current_nutrient_values: nutrientValues,
          }) +
          '\nFill the nutrient values that are null; confirm any known numeric value and keep the same total portion. Do not use an external source.',
          MICRONUTRIENT_COMPLETION_PROMPT,
        );
        const completed = parseJsonObject(completion);
        const completedValues = normalizeNutrients(completed.nutrient_values);
        nutrientValues = Object.fromEntries(NUTRIENT_KEYS.map((key) => [
          key, nutrientValues[key] !== null ? nutrientValues[key] : completedValues[key],
        ])) as Record<(typeof NUTRIENT_KEYS)[number], number | null>;
      } catch {
        // Keep available first-pass values. If Gemini cannot estimate a field after retry, it remains unavailable.
      }
    }

    const description = typeof rawFood.description === 'string' && rawFood.description.trim()
      ? rawFood.description.trim()
      : String(content).slice(0, 200);
    const source = type === 'image' && /nutrition\s*(?:facts|label|table)|food\s*label/i.test(String(context || ''))
      ? 'Gemini AI label extraction plus Gemini food estimate'
      : 'Gemini AI nutrition estimate';

    return NextResponse.json({
      food: {
        description,
        brand_name: typeof rawFood.brand_name === 'string' ? rawFood.brand_name : null,
        default_serving_size: finiteNonNegative(rawFood.default_serving_size),
        default_serving_unit: typeof rawFood.default_serving_unit === 'string' ? rawFood.default_serving_unit : 'g',
        energy_kcal: finiteNonNegative(rawFood.energy_kcal),
        protein_g: finiteNonNegative(rawFood.protein_g),
        fat_g: finiteNonNegative(rawFood.fat_g),
        saturated_fat_g: finiteNonNegative(rawFood.saturated_fat_g),
        carbs_g: finiteNonNegative(rawFood.carbs_g),
        fiber_g: finiteNonNegative(rawFood.fiber_g),
        sugar_g: finiteNonNegative(rawFood.sugar_g),
        sodium_mg: finiteNonNegative(rawFood.sodium_mg),
        cholesterol_mg: finiteNonNegative(rawFood.cholesterol_mg),
        nutrient_values: nutrientValues,
        nutrient_source: source,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('No AI provider') || message.includes('GEMINI_API_KEY')) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    if (message.includes('JSON') || message.includes('Unexpected token')) {
      return NextResponse.json({ error: 'Gemini returned invalid data. Retry extraction once.' }, { status: 502 });
    }
    return NextResponse.json({ error: 'Gemini nutrition estimate failed: ' + message }, { status: 502 });
  }
}
