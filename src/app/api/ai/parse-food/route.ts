import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getProvider } from '@/lib/ai-providers';
import { checkRateLimit } from '@/lib/rate-limit';

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
- For nutrition labels or nutrition data explicitly supplied in the user's text/image, extract only values that are actually shown. Do not calculate missing micronutrients.
- The fields in nutrient_values are NOT general AI estimates. Fill them only when the supplied label/table/text explicitly gives their values. For ordinary food descriptions or a food photo without quantified nutrition information, return null for every nutrient_values field.
- Never use 0 to mean unknown. Keep unavailable values null. Do not infer micronutrients from memory or invent precision.
- Use these units in nutrient_values: omega3 in g; calcium, iron, zinc and vitamin_c in mg; vitamin_d, b12, folate, vitamin_a and iodine in µg. Preserve a value only when its unit can be read or safely converted from the supplied data.
- Set nutrient_source to "User-provided nutrition label/data" only when extracting explicitly supplied nutrition information; otherwise return null.
- Do NOT include tags; the user manages tags manually.
- Return ONLY the JSON object, no markdown fences and no explanation.`;

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
    const nutrientKeys = ['omega3', 'calcium', 'iron', 'zinc', 'vitamin_d', 'b12', 'folate', 'vitamin_c', 'vitamin_a', 'iodine'];
    const nutrientValues = Object.fromEntries(nutrientKeys.map((key) => {
      const value = rawNutrients[key];
      return [key, typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null];
    }));
    const nutrientSource = typeof rawFood.nutrient_source === 'string' && rawFood.nutrient_source.trim()
      ? rawFood.nutrient_source.trim()
      : null;
    return NextResponse.json({ food: { ...rawFood, nutrient_values: nutrientValues, nutrient_source: nutrientSource } });
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
