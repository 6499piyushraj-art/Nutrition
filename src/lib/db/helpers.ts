import { db, schema } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

export async function recalcDiaryTotals(diaryEntryId: string): Promise<void> {
  const result = await db.select({
    totalCalories: sql<number | null>`CASE WHEN COUNT(*) = 0 THEN 0 WHEN COUNT(${schema.foodEntries.energyKcal}) = COUNT(*) THEN SUM(${schema.foodEntries.energyKcal}) ELSE NULL END`,
    totalProteinG: sql<number | null>`CASE WHEN COUNT(*) = 0 THEN 0 WHEN COUNT(${schema.foodEntries.proteinG}) = COUNT(*) THEN SUM(${schema.foodEntries.proteinG}) ELSE NULL END`,
    totalCarbsG: sql<number | null>`CASE WHEN COUNT(*) = 0 THEN 0 WHEN COUNT(${schema.foodEntries.carbsG}) = COUNT(*) THEN SUM(${schema.foodEntries.carbsG}) ELSE NULL END`,
    totalFatG: sql<number | null>`CASE WHEN COUNT(*) = 0 THEN 0 WHEN COUNT(${schema.foodEntries.fatG}) = COUNT(*) THEN SUM(${schema.foodEntries.fatG}) ELSE NULL END`,
    totalFiberG: sql<number | null>`CASE WHEN COUNT(*) = 0 THEN 0 WHEN COUNT(${schema.foodEntries.fiberG}) = COUNT(*) THEN SUM(${schema.foodEntries.fiberG}) ELSE NULL END`,
    totalSodiumMg: sql<number | null>`CASE WHEN COUNT(*) = 0 THEN 0 WHEN COUNT(${schema.foodEntries.sodiumMg}) = COUNT(*) THEN SUM(${schema.foodEntries.sodiumMg}) ELSE NULL END`,
    totalSugarG: sql<number | null>`CASE WHEN COUNT(*) = 0 THEN 0 WHEN COUNT(${schema.foodEntries.sugarG}) = COUNT(*) THEN SUM(${schema.foodEntries.sugarG}) ELSE NULL END`,
  }).from(schema.foodEntries).where(eq(schema.foodEntries.diaryEntryId, diaryEntryId)).get();

  if (!result) return;
  await db.update(schema.diaryEntries).set({
    totalCalories: result.totalCalories,
    totalProteinG: result.totalProteinG,
    totalCarbsG: result.totalCarbsG,
    totalFatG: result.totalFatG,
    totalFiberG: result.totalFiberG,
    totalSodiumMg: result.totalSodiumMg,
    totalSugarG: result.totalSugarG,
  }).where(eq(schema.diaryEntries.id, diaryEntryId)).run();
}
