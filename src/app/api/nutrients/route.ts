import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { getDefaultNutrientTargets, NUTRIENT_SPECS, type NutrientConfidence, type NutrientStatus } from '@/lib/nutrients';

type FoodRow = {
  energyKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sodiumMg: number | null;
  nutrientValues: Record<string, number> | null;
  nutrientSource: string | null;
};
function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function macroValue(row: FoodRow, key: string): number | null {
  switch (key) {
    case 'calories': return toNumber(row.energyKcal);
    case 'protein': return toNumber(row.proteinG);
    case 'carbs': return toNumber(row.carbsG);
    case 'fat': return toNumber(row.fatG);
    case 'fiber': return toNumber(row.fiberG);
    case 'sodium': return toNumber(row.sodiumMg);
    default: return null;
  }
}
function confidenceFor(sources: Array<string | null>): NutrientConfidence {
  const known = sources.filter((source): source is string => Boolean(source));
  if (!known.length) return 'unknown';
  if (known.every((source) => /USDA|FoodData Central|Open Food Facts/i.test(source))) return 'database';
  if (known.every((source) => /Gemini|AI estimate/i.test(source))) return 'estimated';
  const hasDb = known.some((source) => /USDA|FoodData Central|Open Food Facts/i.test(source));
  const hasAi = known.some((source) => /Gemini|AI estimate/i.test(source));
  if (hasDb && hasAi) return 'mixed';
  if (known.every((source) => /manual|user-entered/i.test(source))) return 'user-entered';
  return 'unknown';
}
async function readTargets(userId: string) {
  const profile = await db.select({
    dateOfBirth: schema.healthProfiles.dateOfBirth,
    sex: schema.healthProfiles.sex,
  }).from(schema.healthProfiles).where(eq(schema.healthProfiles.userId, userId)).get();
  const row = await db.select().from(schema.nutrientTargets).where(eq(schema.nutrientTargets.userId, userId)).get();
  const defaults = getDefaultNutrientTargets(profile);
  const saved = row?.targets && typeof row.targets === 'object' && !Array.isArray(row.targets)
    ? row.targets as Record<string, unknown>
    : {};
  return Object.fromEntries(NUTRIENT_SPECS.map((spec) => {
    const value = saved[spec.key];
    return [spec.key, typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : defaults[spec.key]];
  })) as ReturnType<typeof getDefaultNutrientTargets>;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const defaultDate = String(now.getFullYear()) + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const date = searchParams.get('date') || defaultDate;
  try {
    const targets = await readTargets(session.user.id);
    const rows = await db.select({
      energyKcal: schema.foodEntries.energyKcal,
      proteinG: schema.foodEntries.proteinG,
      carbsG: schema.foodEntries.carbsG,
      fatG: schema.foodEntries.fatG,
      fiberG: schema.foodEntries.fiberG,
      sodiumMg: schema.foodEntries.sodiumMg,
      nutrientValues: schema.foodEntries.nutrientValues,
      nutrientSource: schema.foodEntries.nutrientSource,
    }).from(schema.foodEntries)
      .innerJoin(schema.diaryEntries, eq(schema.foodEntries.diaryEntryId, schema.diaryEntries.id))
      .where(and(
        eq(schema.diaryEntries.userId, session.user.id),
        eq(schema.diaryEntries.date, date),
        eq(schema.diaryEntries.type, 'diary_meal'),
      )).all() as FoodRow[];

    const nutrition: Record<string, { value: number | null; status: NutrientStatus; confidence: NutrientConfidence; knownFoods: number; totalFoods: number }> = {};
    for (const spec of NUTRIENT_SPECS) {
      const items = rows.map((row) => {
        const direct = macroValue(row, spec.key);
        if (direct !== null) return direct;
        return row.nutrientValues && typeof row.nutrientValues === 'object'
          ? toNumber(row.nutrientValues[spec.key]) : null;
      });
      const known = items.filter((value): value is number => value !== null);
      const knownFoods = known.length;
      const status: NutrientStatus = rows.length === 0 ? 'no_food'
        : knownFoods === rows.length ? 'complete'
        : knownFoods > 0 ? 'partial' : 'unavailable';
      const value = status === 'complete' ? Math.round(known.reduce((sum, n) => sum + n, 0) * 1000) / 1000 : null;
      const sources = rows.filter((_row, index) => items[index] !== null).map((row) => row.nutrientSource);
      nutrition[spec.key] = { value, status, confidence: confidenceFor(sources), knownFoods, totalFoods: rows.length };
    }
    return NextResponse.json({
      date, targets, nutrition, foodsLogged: rows.length,
      targetNotes: {
        valuesAreConfigurable: true,
        referenceNotPrescription: true,
        sodiumIsLimit: true,
        microSourcePolicy: 'Only food-composition data attached to saved foods is counted; Gemini does not invent micronutrient values.',
      },
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load nutrient summary: ' + (err instanceof Error ? err.message : 'Unknown') }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    if (!body.targets || typeof body.targets !== 'object' || Array.isArray(body.targets)) {
      return NextResponse.json({ error: 'A target map is required.' }, { status: 400 });
    }
    const profile = await db.select({
      dateOfBirth: schema.healthProfiles.dateOfBirth,
      sex: schema.healthProfiles.sex,
    }).from(schema.healthProfiles).where(eq(schema.healthProfiles.userId, session.user.id)).get();
    const previous = await db.select().from(schema.nutrientTargets).where(eq(schema.nutrientTargets.userId, session.user.id)).get();
    const defaults = getDefaultNutrientTargets(profile);
    const saved = previous?.targets && typeof previous.targets === 'object' && !Array.isArray(previous.targets)
      ? previous.targets as Record<string, unknown>
      : {};
    const targets: Record<string, number> = Object.fromEntries(NUTRIENT_SPECS.map((spec) => {
      const value = saved[spec.key];
      return [spec.key, typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : defaults[spec.key]];
    }));
    const allowed = new Set(NUTRIENT_SPECS.map((item) => item.key));
    for (const [key, value] of Object.entries(body.targets as Record<string, unknown>)) {
      if (!allowed.has(key as never)) continue;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10000000) {
        return NextResponse.json({ error: 'Target values must be finite, non-negative numbers.' }, { status: 400 });
      }
      targets[key] = value;
    }
    if (previous) {
      await db.update(schema.nutrientTargets).set({ targets, updatedAt: new Date().toISOString() })
        .where(eq(schema.nutrientTargets.userId, session.user.id)).run();
    } else {
      await db.insert(schema.nutrientTargets).values({ userId: session.user.id, targets }).run();
    }
    await db.update(schema.healthProfiles).set({
      dailyCalorieGoal: targets.calories,
      goalProteinG: targets.protein,
      goalCarbsG: targets.carbs,
      goalFatG: targets.fat,
      goalFiberG: targets.fiber,
    }).where(eq(schema.healthProfiles.userId, session.user.id)).run();
    return NextResponse.json({ success: true, targets });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to save nutrient targets: ' + (err instanceof Error ? err.message : 'Unknown') }, { status: 500 });
  }
}
