import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { getDefaultNutrientTargets, NUTRIENT_SPECS } from '@/lib/nutrients';
import { ageFromDateOfBirth } from '@/lib/nutrition-calculator';

const fields: Record<string, string> = {
  date_of_birth: 'dateOfBirth', height_ft: 'heightFt', height_in: 'heightIn',
  starting_weight_lbs: 'startingWeightLbs', current_weight_lbs: 'currentWeightLbs',
  goal_weight_lbs: 'goalWeightLbs', goal_target_date: 'goalTargetDate',
  activity_level: 'activityLevel', weekly_goal: 'weeklyGoal',
  daily_calorie_goal: 'dailyCalorieGoal', daily_step_goal: 'dailyStepGoal',
  goal_water_oz: 'goalWaterOz', goal_protein_g: 'goalProteinG', goal_carbs_g: 'goalCarbsG',
  goal_fat_g: 'goalFatG', goal_fiber_g: 'goalFiberG', goal_sodium_mg: 'goalSodiumMg',
  goal_sugar_g: 'goalSugarG', unit_system: 'unitSystem', meal_names: 'mealNames',
  notes: 'notes', sex: 'sex',
};
function toCamel(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).flatMap(([key, value]) => fields[key] ? [[fields[key], value]] : []));
}
function toSnake(data: Record<string, unknown>) {
  const reverse = Object.fromEntries(Object.entries(fields).map(([snake, camel]) => [camel, snake]));
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [reverse[key] || key, value]));
}
function ageFromDob(value: unknown): number | null {
  return typeof value === 'string' ? ageFromDateOfBirth(value) : null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const { profileId, ...data } = body;
    const update = toCamel(data);
    const existing = await db.select().from(schema.healthProfiles)
      .where(eq(schema.healthProfiles.userId, session.user.id)).get();
    if (profileId && (!existing || existing.id !== profileId)) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    const age = ageFromDob(typeof update.dateOfBirth === 'string' ? update.dateOfBirth : existing?.dateOfBirth);
    if (age === null || age < 18) {
      delete update.goalWeightLbs;
      delete update.goalTargetDate;
      delete update.weeklyGoal;
      delete update.dailyCalorieGoal;
    }

    const profile = existing
      ? await db.update(schema.healthProfiles).set(update)
          .where(and(eq(schema.healthProfiles.id, existing.id), eq(schema.healthProfiles.userId, session.user.id)))
          .returning().get()
      : await db.insert(schema.healthProfiles).values({ userId: session.user.id, ...update }).returning().get();

    const saved = await db.select().from(schema.healthProfiles)
      .where(eq(schema.healthProfiles.userId, session.user.id)).get();
    const previous = await db.select().from(schema.nutrientTargets)
      .where(eq(schema.nutrientTargets.userId, session.user.id)).get();
    const defaults = getDefaultNutrientTargets(saved);
    const stored = previous?.targets && typeof previous.targets === 'object' && !Array.isArray(previous.targets)
      ? previous.targets as Record<string, unknown> : {};
    const targets = Object.fromEntries(NUTRIENT_SPECS.map((spec) => {
      const value = stored[spec.key];
      return [spec.key, typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : defaults[spec.key]];
    })) as ReturnType<typeof getDefaultNutrientTargets>;

    if (saved) {
      targets.protein = saved.goalProteinG ?? targets.protein;
      targets.carbs = saved.goalCarbsG ?? targets.carbs;
      targets.fat = saved.goalFatG ?? targets.fat;
      targets.fiber = saved.goalFiberG ?? targets.fiber;
      if (age === null || age >= 18) targets.calories = saved.dailyCalorieGoal ?? targets.calories;
    }
    if (previous) await db.update(schema.nutrientTargets).set({ targets, updatedAt: new Date().toISOString() })
      .where(eq(schema.nutrientTargets.userId, session.user.id)).run();
    else await db.insert(schema.nutrientTargets).values({ userId: session.user.id, targets }).run();

    return NextResponse.json({ profile: toSnake(profile as unknown as Record<string, unknown>) });
  } catch {
    return NextResponse.json({ error: 'Could not save profile changes.' }, { status: 500 });
  }
}
