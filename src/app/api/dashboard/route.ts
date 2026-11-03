import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { and, eq, sql } from 'drizzle-orm';
import { validIsoDate } from '@/lib/nutrition-calculator';

export const dynamic = 'force-dynamic';

function ageFromDob(value?: string | null): number | null {
  if (!value || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return null;
  const dob = new Date(value + 'T00:00:00');
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const now = new Date();
  const fallback = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
  const today = new URL(request.url).searchParams.get('date') || fallback;
  if (!validIsoDate(today)) return NextResponse.json({ error: 'date must be YYYY-MM-DD.' }, { status: 400 });

  try {
    const profile = await db.select({
      date_of_birth: schema.healthProfiles.dateOfBirth,
      daily_calorie_goal: schema.healthProfiles.dailyCalorieGoal,
      goal_protein_g: schema.healthProfiles.goalProteinG,
      goal_carbs_g: schema.healthProfiles.goalCarbsG,
      goal_fat_g: schema.healthProfiles.goalFatG,
    }).from(schema.healthProfiles).where(eq(schema.healthProfiles.userId, session.user.id)).get();

    const totalsResult = await db.select({
      calories: sql<number | null>`CASE WHEN COUNT(*) = 0 THEN 0 WHEN COUNT(${schema.diaryEntries.totalCalories}) = COUNT(*) THEN SUM(${schema.diaryEntries.totalCalories}) ELSE NULL END`,
      protein: sql<number | null>`CASE WHEN COUNT(*) = 0 THEN 0 WHEN COUNT(${schema.diaryEntries.totalProteinG}) = COUNT(*) THEN SUM(${schema.diaryEntries.totalProteinG}) ELSE NULL END`,
      carbs: sql<number | null>`CASE WHEN COUNT(*) = 0 THEN 0 WHEN COUNT(${schema.diaryEntries.totalCarbsG}) = COUNT(*) THEN SUM(${schema.diaryEntries.totalCarbsG}) ELSE NULL END`,
      fat: sql<number | null>`CASE WHEN COUNT(*) = 0 THEN 0 WHEN COUNT(${schema.diaryEntries.totalFatG}) = COUNT(*) THEN SUM(${schema.diaryEntries.totalFatG}) ELSE NULL END`,
      mealsLogged: sql<number>`COUNT(*)`,
    }).from(schema.diaryEntries).where(and(
      eq(schema.diaryEntries.userId, session.user.id),
      eq(schema.diaryEntries.date, today),
      eq(schema.diaryEntries.type, 'diary_meal'),
    )).get();

    const age = ageFromDob(profile?.date_of_birth);
    const isMinor = age !== null && age < 18;
    const response = NextResponse.json({
      user: { first_name: session.user.first_name, last_name: session.user.last_name },
      profile: profile ? {
        ...profile,
        daily_calorie_goal: isMinor ? null : profile.daily_calorie_goal,
      } : null,
      totals: {
        calories: totalsResult?.calories ?? (totalsResult?.mealsLogged ? null : 0),
        protein: totalsResult?.protein ?? (totalsResult?.mealsLogged ? null : 0),
        carbs: totalsResult?.carbs ?? (totalsResult?.mealsLogged ? null : 0),
        fat: totalsResult?.fat ?? (totalsResult?.mealsLogged ? null : 0),
      },
      hasProfile: !!profile,
      isMinor,
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
    response.headers.set('Pragma', 'no-cache');
    return response;
  } catch {
    return NextResponse.json({ error: 'Could not load dashboard data.' }, { status: 500 });
  }
}
