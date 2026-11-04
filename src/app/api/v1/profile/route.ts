import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { getDefaultNutrientTargets, getNutrientReferenceMetadata } from '@/lib/nutrients';
import { isUnder18OrUnknown } from '@/lib/nutrition-calculator';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const profile = await db.select().from(schema.healthProfiles)
      .where(eq(schema.healthProfiles.userId, session.user.id)).get();
    const stored = await db.select().from(schema.nutrientTargets)
      .where(eq(schema.nutrientTargets.userId, session.user.id)).get();
    const isMinor = isUnder18OrUnknown(profile?.dateOfBirth);
    const defaults = getDefaultNutrientTargets(profile);
    const savedTargets = stored?.targets && typeof stored.targets === 'object' && !Array.isArray(stored.targets)
      ? stored.targets as Record<string, unknown> : {};
    const targets = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
      const value = savedTargets[key];
      return [key, value === null ? null : typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback];
    }));

    const safeProfile = profile ? {
      id: profile.id,
      date_of_birth: profile.dateOfBirth,
      sex: profile.sex,
      height_ft: profile.heightFt,
      height_in: profile.heightIn,
      activity_level: profile.activityLevel,
      unit_system: profile.unitSystem,
      meal_names: profile.mealNames,
      goal_water_oz: profile.goalWaterOz,
      daily_step_goal: profile.dailyStepGoal,
      ...(isMinor ? {} : {
        starting_weight_lbs: profile.startingWeightLbs,
        current_weight_lbs: profile.currentWeightLbs,
        goal_weight_lbs: profile.goalWeightLbs,
        goal_target_date: profile.goalTargetDate,
        weekly_goal: profile.weeklyGoal,
        daily_calorie_goal: profile.dailyCalorieGoal,
      }),
    } : null;

    return NextResponse.json({
      profile: safeProfile,
      targets: isMinor ? Object.fromEntries(Object.entries(targets).filter(([key]) => key !== 'calories')) : targets,
      targetReference: getNutrientReferenceMetadata(profile),
      isMinor,
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch {
    return NextResponse.json({ error: 'Could not load profile settings.' }, { status: 500 });
  }
}
