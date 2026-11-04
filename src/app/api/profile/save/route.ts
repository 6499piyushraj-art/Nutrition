import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { getDefaultNutrientTargets, NUTRIENT_SPECS } from '@/lib/nutrients';
import { validIsoDate } from '@/lib/nutrition-calculator';
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
    if (update.dateOfBirth !== undefined && (typeof update.dateOfBirth !== 'string' || !validIsoDate(update.dateOfBirth))) {
      return NextResponse.json({ error: 'Date of birth must be a valid calendar date in YYYY-MM-DD format.' }, { status: 400 });
    }
    const existing = await db.select().from(schema.healthProfiles)
      .where(eq(schema.healthProfiles.userId, session.user.id)).get();
    if (profileId && (!existing || existing.id !== profileId)) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    const age = ageFromDob(typeof update.dateOfBirth === 'string' ? update.dateOfBirth : existing?.dateOfBirth);
    if (age === null || age < 18) {
      delete update.startingWeightLbs;
      delete update.currentWeightLbs;
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
    const previous = await db.select({ id: schema.nutrientTargets.id })
      .from(schema.nutrientTargets).where(eq(schema.nutrientTargets.userId, session.user.id)).get();

    // Nutrient targets are owned by /api/nutrients. Profile saves must not
    // overwrite an explicitly unset target with legacy profile form defaults.
    if (!previous) {
      await db.insert(schema.nutrientTargets).values({
        userId: session.user.id,
        targets: getDefaultNutrientTargets(saved),
      }).run();
    }

    return NextResponse.json({ profile: toSnake(profile as unknown as Record<string, unknown>) });
  } catch {
    return NextResponse.json({ error: 'Could not save profile changes.' }, { status: 500 });
  }
}
