'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Sparkles, Loader2, RotateCcw, CheckCircle2 } from 'lucide-react';

interface ParsedFood {
  description: string;
  brand_name: string | null;
  default_serving_size: number | null;
  default_serving_unit: string | null;
  energy_kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  carbs_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  cholesterol_mg: number | null;
  nutrient_values?: Record<string, number | null> | null;
  nutrient_source?: string | null;
}

function localDate() {
  const now = new Date();
  return String(now.getFullYear()) + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
}

function nutritionValue(value: number | null, unit: string) {
  return value === null || value === undefined ? '—' : String(Math.round(value * 10) / 10) + unit;
}

function nutrientValue(value: number | null | undefined, unit: string) {
  return typeof value === 'number' && Number.isFinite(value) ? nutritionValue(value, ' ' + unit) : 'Data unavailable';
}

function AddFoodForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = searchParams.get('date') || localDate();
  const [inputText, setInputText] = useState('');
  const [parsedFood, setParsedFood] = useState<ParsedFood | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function analyzeFood(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inputText.trim() || parsing) return;
    setParsing(true);
    setError('');
    setParsedFood(null);

    try {
      const res = await fetch('/api/ai/parse-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'text',
          content: 'This is my complete food log. Read Hindi, Hinglish, or English, understand the portions, and estimate nutrition for ALL items together. Keep the description faithful to what I wrote. Food log: ' + inputText.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Nutrition extraction failed');
      if (!data.food || !data.food.description) throw new Error('AI did not return a food description. Try adding clearer quantities.');
      setParsedFood(data.food as ParsedFood);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process food. Please try again.');
    } finally {
      setParsing(false);
    }
  }

  async function saveToDiary() {
    if (!parsedFood || saving) return;
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/diary/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          meal: 'Food Log',
          quantity: 1,
          food: {
            food_id: null,
            description: parsedFood.description,
            source: 'ai-log',
            serving_size: parsedFood.default_serving_size || 1,
            serving_unit: parsedFood.default_serving_unit || 'log',
            calories: parsedFood.energy_kcal,
            protein_g: parsedFood.protein_g,
            fat_g: parsedFood.fat_g,
            carbs_g: parsedFood.carbs_g,
            fiber_g: parsedFood.fiber_g,
            sugar_g: parsedFood.sugar_g,
            sodium_mg: parsedFood.sodium_mg,
            saturated_fat_g: parsedFood.saturated_fat_g,
            cholesterol_mg: parsedFood.cholesterol_mg,
            nutrient_values: parsedFood.nutrient_values || null,
            nutrient_source: parsedFood.nutrient_source || null,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save food log');
      window.location.href = '/diary/' + date;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save food log. Please retry.');
      setSaving(false);
    }
  }

  function useExample(value: string) {
    setInputText(value);
    setParsedFood(null);
    setError('');
  }

  return (
    <div className="pb-24">
      <button
        onClick={() => router.push('/diary/' + date)}
        className="flex items-center gap-1 text-brand-600 font-medium mb-4 min-h-[44px]"
      >
        <ArrowLeft size={20} /> Back to Food Log
      </button>

      <h1 className="text-2xl font-bold text-gray-900">Log Food</h1>
      <p className="text-sm text-gray-500 mt-1 mb-5">Jo khaya, apni language mein likho. Gemini calories aur nutrients estimate karega.</p>

      <form onSubmit={analyzeFood}>
        <label htmlFor="food-log-input" className="block text-sm font-semibold text-gray-800 mb-2">
          What did you eat? / Aapne kya khaya?
        </label>
        <textarea
          id="food-log-input"
          value={inputText}
          onChange={(event) => { setInputText(event.target.value); setParsedFood(null); setError(''); }}
          placeholder="Example: Subah 2 roti, 1 katori dal, thoda dahi aur 1 glass doodh piya..."
          rows={5}
          maxLength={2000}
          autoFocus
          className="w-full resize-y rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-base leading-6 text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <p className="text-xs text-gray-400 mt-1 mb-4">Quantity likhne se estimate behtar hoga. Example: “100g poha with peanuts”</p>

        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Try an example</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => useExample('2 roti, 1 katori dal aur thoda dahi')} className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 active:bg-gray-100">Hindi / Hinglish</button>
            <button type="button" onClick={() => useExample('100g poha with peanuts and one cup chai')} className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 active:bg-gray-100">English</button>
            <button type="button" onClick={() => useExample('सुबह 2 उबले अंडे और 1 केला खाया')} className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 active:bg-gray-100">हिन्दी</button>
          </div>
        </div>

        {error && (
          <div role="alert" className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4">{error}</div>
        )}

        {!parsedFood && (
          <button type="submit" disabled={parsing || !inputText.trim()} className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-4 text-lg font-semibold text-white active:bg-brand-800 disabled:opacity-50 min-h-[54px]">
            {parsing ? <><Loader2 size={20} className="animate-spin" /> Processing food...</> : <><Sparkles size={20} /> Extract Nutrition</>}
          </button>
        )}
      </form>

      {parsedFood && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="bg-brand-50 border-b border-brand-100 p-4">
            <div className="flex items-center gap-2 text-brand-700">
              <CheckCircle2 size={20} />
              <h2 className="font-semibold">Nutrition estimate ready</h2>
            </div>
            <p className="mt-2 font-semibold text-gray-900">{parsedFood.description}</p>
            <p className="mt-1 text-xs text-gray-500">AI estimates hain. Save karne se pehle quantity/values check kar lo.</p>
          </div>

          <div className="space-y-5 p-4">
            <section>
              <h3 className="mb-3 font-semibold text-gray-800">Energy & Macronutrients</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { label: 'Calories', value: nutritionValue(parsedFood.energy_kcal, ' kcal') },
                  { label: 'Protein', value: nutritionValue(parsedFood.protein_g, ' g') },
                  { label: 'Carbohydrates', value: nutritionValue(parsedFood.carbs_g, ' g') },
                  { label: 'Total fat', value: nutritionValue(parsedFood.fat_g, ' g') },
                  { label: 'Omega-3', value: nutrientValue(parsedFood.nutrient_values?.omega3, 'g') },
                  { label: 'Dietary fiber', value: nutritionValue(parsedFood.fiber_g, ' g') },
                ].map((item) => (
                  <div key={item.label} className="min-w-0 rounded-xl border border-gray-100 p-3">
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="mt-1 break-words text-base font-bold text-gray-900">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h3 className="mb-1 font-semibold text-gray-800">Essential Micronutrients</h3>
              <p className="mb-3 text-xs text-gray-500">Micronutrients are looked up from food-composition data when a food match is available. Portion weights may be estimated; values the database does not report stay unavailable.</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { key: 'calcium', label: 'Calcium', unit: 'mg' },
                  { key: 'iron', label: 'Iron', unit: 'mg' },
                  { key: 'zinc', label: 'Zinc', unit: 'mg' },
                  { key: 'vitamin_d', label: 'Vitamin D', unit: 'µg' },
                  { key: 'b12', label: 'Vitamin B12', unit: 'µg' },
                  { key: 'folate', label: 'Folate (B9)', unit: 'µg' },
                  { key: 'vitamin_c', label: 'Vitamin C', unit: 'mg' },
                  { key: 'vitamin_a', label: 'Vitamin A', unit: 'µg' },
                  { key: 'iodine', label: 'Iodine', unit: 'µg' },
                ].map((item) => (
                  <div key={item.key} className="min-w-0 rounded-xl border border-gray-100 p-3">
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="mt-1 break-words text-base font-bold text-gray-900">{nutrientValue(parsedFood.nutrient_values?.[item.key], item.unit)}</p>
                  </div>
                ))}
              </div>
              {parsedFood.nutrient_source && <p className="mt-2 text-[11px] text-gray-400">Source: {parsedFood.nutrient_source}</p>}
            </section>
            <p className="text-xs text-gray-500">Serving represented by this log: {parsedFood.default_serving_size || 1} {parsedFood.default_serving_unit || 'log'}</p>
          </div>

          <div className="space-y-2 p-4">
            <button onClick={saveToDiary} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-4 text-lg font-semibold text-white active:bg-brand-800 disabled:opacity-50 min-h-[54px]">
              {saving ? <><Loader2 size={20} className="animate-spin" /> Saving...</> : <><CheckCircle2 size={20} /> Add to Today’s Food Log</>}
            </button>
            <button onClick={() => { setParsedFood(null); setError(''); }} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-700 disabled:opacity-50 min-h-[48px]">
              <RotateCcw size={18} /> Edit food description
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AddFoodPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-gray-500">Loading food logger...</div>}>
      <AddFoodForm />
    </Suspense>
  );
}
