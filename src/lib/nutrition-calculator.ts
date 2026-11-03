export type NutrientAggregate = { value: number | null; status: 'no_food' | 'complete' | 'partial' | 'unavailable'; knownFoods: number; totalFoods: number };

export function scaleNutrients<T extends Record<string, number | null | undefined>>(values: T, quantity: number): { [K in keyof T]: number | null } {
  if (!Number.isFinite(quantity) || quantity < 0) throw new RangeError('Quantity must be finite and non-negative.');
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key,
    typeof value === 'number' && Number.isFinite(value) ? Math.round(value * quantity * 1000) / 1000 : null,
  ])) as { [K in keyof T]: number | null };
}

export function aggregateKnownValues(values: Array<number | null | undefined>): NutrientAggregate {
  if (!values.length) return { value: null, status: 'no_food', knownFoods: 0, totalFoods: 0 };
  const known = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (known.length !== values.length) return {
    value: null, status: known.length ? 'partial' : 'unavailable',
    knownFoods: known.length, totalFoods: values.length,
  };
  return {
    value: Math.round(known.reduce((sum, value) => sum + value, 0) * 1000) / 1000,
    status: 'complete', knownFoods: known.length, totalFoods: values.length,
  };
}

export function validIsoDate(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
