'use client';

import { useState } from 'react';

export type SavedFoodForLogging = {
  id: string;
  description: string;
  brandName: string | null;
  source: string | null;
  fdcId: number | null;
  servingSize: number | null;
  servingUnit: string | null;
  energyKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  nutrientValues: Record<string, number> | null;
  nutrientSource: string | null;
};

export default function LogSavedFoodButton({ date, food }: { date: string; food: SavedFoodForLogging }) {
  const [open, setOpen] = useState(true);
  const [meal, setMeal] = useState('Snacks');
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function logFood() {
    const multiplier = Number(quantity);
    if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 10000) {
      setError('Enter a serving quantity greater than zero.');
      return;
    }
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/diary/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date, meal, quantity: multiplier,
          food: {
            food_id: food.id,
            description: food.description,
            source: food.source,
            fdc_id: food.fdcId,
            brand_name: food.brandName,
            serving_size: food.servingSize ?? 1,
            serving_unit: food.servingUnit || 'serving',
            calories: food.energyKcal,
            protein_g: food.proteinG,
            fat_g: food.fatG,
            carbs_g: food.carbsG,
            fiber_g: food.fiberG,
            sugar_g: food.sugarG,
            sodium_mg: food.sodiumMg,
            nutrient_values: food.nutrientValues,
            nutrient_source: food.nutrientSource,
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not add this food to your diary.');
      window.location.href = '/diary/' + date;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log this food.');
      setSaving(false);
    }
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-5 min-h-[48px] w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white">Log this food on {date}</button>;

  return (
    <section className="mt-5 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
      <h2 className="font-semibold text-gray-900">Log this saved food</h2>
      <p className="mt-1 text-xs text-gray-600">
        {date} · Base serving: {food.servingSize ?? 1} {food.servingUnit || 'serving'}. Change the multiplier to log more or less.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-gray-600">Meal
          <select value={meal} onChange={(event) => setMeal(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900">
            <option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snacks</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-600">Serving multiplier
          <input type="number" min="0.01" max="10000" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900" />
        </label>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setOpen(false)} disabled={saving} className="min-h-[46px] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700">Cancel</button>
        <button type="button" onClick={() => void logFood()} disabled={saving} className="min-h-[46px] flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Adding…' : 'Add to diary'}</button>
      </div>
    </section>
  );
}
