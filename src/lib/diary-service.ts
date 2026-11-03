import { and, asc, eq, gte, lte } from 'drizzle-orm';
type DiaryRow = typeof schema.diaryEntries.$inferSelect;
import { db, schema } from '@/lib/db';
import { NUTRIENT_SPECS } from '@/lib/nutrients';
import { aggregateKnownValues } from '@/lib/nutrition-calculator';

type FoodRow = {
  id: string; diaryEntryId: string; foodId: string | null; quantity: number;
  energyKcal: number | null; proteinG: number | null; carbsG: number | null;
  fatG: number | null; fiberG: number | null; sodiumMg: number | null;
  sugarG: number | null; nutrientValues: Record<string, number> | null;
  nutrientSource: string | null; description: string | null; brandName: string | null;
  defaultServingSize: number | null; defaultServingUnit: string | null;
};

function valueFor(row: FoodRow, key: string): number | null {
  const direct: Record<string, number | null> = {
    calories: row.energyKcal, protein: row.proteinG, carbs: row.carbsG,
    fat: row.fatG, fiber: row.fiberG, sodium: row.sodiumMg, sugar: row.sugarG,
  };
  if (Object.prototype.hasOwnProperty.call(direct, key)) return direct[key];
  const value = row.nutrientValues?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export async function getDiaryDay(userId: string, date: string) {
  const entries: DiaryRow[] = await db.select().from(schema.diaryEntries).where(and(
    eq(schema.diaryEntries.userId, userId), eq(schema.diaryEntries.date, date),
    eq(schema.diaryEntries.type, 'diary_meal'),
  )).orderBy(asc(schema.diaryEntries.createdAt)).all() as DiaryRow[];

  const rows = await db.select({
    id: schema.foodEntries.id, diaryEntryId: schema.foodEntries.diaryEntryId,
    foodId: schema.foodEntries.foodId, quantity: schema.foodEntries.quantity,
    energyKcal: schema.foodEntries.energyKcal, proteinG: schema.foodEntries.proteinG,
    carbsG: schema.foodEntries.carbsG, fatG: schema.foodEntries.fatG,
    fiberG: schema.foodEntries.fiberG, sodiumMg: schema.foodEntries.sodiumMg,
    sugarG: schema.foodEntries.sugarG, nutrientValues: schema.foodEntries.nutrientValues,
    nutrientSource: schema.foodEntries.nutrientSource,
    description: schema.foods.description, brandName: schema.foods.brandName,
    defaultServingSize: schema.foods.defaultServingSize, defaultServingUnit: schema.foods.defaultServingUnit,
  }).from(schema.foodEntries)
    .innerJoin(schema.diaryEntries, eq(schema.foodEntries.diaryEntryId, schema.diaryEntries.id))
    .leftJoin(schema.foods, eq(schema.foodEntries.foodId, schema.foods.id))
    .where(and(eq(schema.diaryEntries.userId, userId), eq(schema.diaryEntries.date, date),
      eq(schema.diaryEntries.type, 'diary_meal'))).all() as FoodRow[];

  const meals = entries.map((entry) => {
    const mealRows = rows.filter((row) => row.diaryEntryId === entry.id);
    const foods = mealRows.map((row) => ({
      id: row.id, food_id: row.foodId, description: row.description, brand_name: row.brandName,
      quantity: row.quantity, serving_size: row.defaultServingSize, unit: row.defaultServingUnit,
      calories: row.energyKcal, protein_g: row.proteinG, carbs_g: row.carbsG, fat_g: row.fatG,
      fiber_g: row.fiberG, sodium_mg: row.sodiumMg, sugar_g: row.sugarG,
      nutrient_values: row.nutrientValues, nutrient_source: row.nutrientSource,
    }));
    const nutrition = Object.fromEntries(NUTRIENT_SPECS.map((spec) => [
      spec.key, aggregateKnownValues(mealRows.map((row) => valueFor(row, spec.key))),
    ]));
    return { id: entry.id, meal: entry.diaryMeal || 'Meal', notes: entry.notes, foods, nutrition };
  });
  const nutrition = Object.fromEntries(NUTRIENT_SPECS.map((spec) => [
    spec.key, aggregateKnownValues(rows.map((row) => valueFor(row, spec.key))),
  ]));
  return { date, meals, nutrition, foodsLogged: rows.length };
}

export async function getDiaryRange(userId: string, from: string, to: string) {
  const rows = await db.select({
    diaryEntryId: schema.foodEntries.diaryEntryId, date: schema.diaryEntries.date,
    energyKcal: schema.foodEntries.energyKcal, proteinG: schema.foodEntries.proteinG,
    carbsG: schema.foodEntries.carbsG, fatG: schema.foodEntries.fatG,
    fiberG: schema.foodEntries.fiberG, sodiumMg: schema.foodEntries.sodiumMg,
    sugarG: schema.foodEntries.sugarG, nutrientValues: schema.foodEntries.nutrientValues,
    nutrientSource: schema.foodEntries.nutrientSource,
  }).from(schema.foodEntries)
    .innerJoin(schema.diaryEntries, eq(schema.foodEntries.diaryEntryId, schema.diaryEntries.id))
    .where(and(eq(schema.diaryEntries.userId, userId), eq(schema.diaryEntries.type, 'diary_meal'),
      gte(schema.diaryEntries.date, from), lte(schema.diaryEntries.date, to))).all() as Array<FoodRow & { date: string }>;

  const dates = [...new Set(rows.map((row) => row.date))].sort();
  const days = dates.map((date) => {
    const dayRows = rows.filter((row) => row.date === date);
    return { date, foodsLogged: dayRows.length, nutrition: Object.fromEntries(NUTRIENT_SPECS.map((spec) => [
      spec.key, aggregateKnownValues(dayRows.map((row) => valueFor(row, spec.key))),
    ])) };
  });
  const averages = Object.fromEntries(NUTRIENT_SPECS.map((spec) => {
    const values = days.map((day) => day.nutrition[spec.key]).filter((item) => item.status !== 'no_food');
    if (!values.length) return [spec.key, aggregateKnownValues([])];
    if (values.some((item) => item.status !== 'complete')) return [spec.key, {
      value: null, status: 'partial',
      knownFoods: values.reduce((sum, item) => sum + item.knownFoods, 0),
      totalFoods: values.reduce((sum, item) => sum + item.totalFoods, 0),
    }];
    return [spec.key, {
      value: Math.round(values.reduce((sum, item) => sum + (item.value ?? 0), 0) / values.length * 1000) / 1000,
      status: 'complete',
      knownFoods: values.reduce((sum, item) => sum + item.knownFoods, 0),
      totalFoods: values.reduce((sum, item) => sum + item.totalFoods, 0),
    }];
  }));
  return { from, to, days, averages };
}
