'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Sparkles, Loader2, RotateCcw, CheckCircle2, Camera, X, Search, BookOpen } from 'lucide-react';

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
  food_id?: string | null;
  fdc_id?: number | null;
  source?: string | null;
}

interface ManualFood {
  id: string;
  description: string;
  brand_name: string | null;
  source: string | null;
  default_serving_size: number | null;
  default_serving_unit: string | null;
  energy_kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  nutrient_values: Record<string, number> | null;
  nutrient_source: string | null;
}

interface ExternalFood {
  fdc_id: number;
  description: string;
  brand: string;
  serving_size: number | null;
  serving_unit: string;
  data_type: string;
  calories: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  fiber_g: number | null;
  nutrient_values?: Record<string, number>;
  nutrient_source?: string;
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
  const [manualQuery, setManualQuery] = useState('');
  const [manualFoods, setManualFoods] = useState<ManualFood[]>([]);
  const [externalFoods, setExternalFoods] = useState<ExternalFood[]>([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [parsedFood, setParsedFood] = useState<ParsedFood | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function analyzeFood(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((!inputText.trim() && !selectedImage) || parsing) return;
    if (selectedImage && (!['image/jpeg', 'image/png', 'image/webp'].includes(selectedImage.type) || selectedImage.size > 3 * 1024 * 1024)) {
      setError('Choose a JPEG, PNG, or WebP photo under 3 MB.');
      return;
    }
    setParsing(true);
    setError('');
    setParsedFood(null);

    try {
      let imageBase64: string | null = null;
      if (selectedImage) {
        const bytes = new Uint8Array(await selectedImage.arrayBuffer());
        let binary = '';
        for (let index = 0; index < bytes.length; index += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
        }
        imageBase64 = btoa(binary);
      }
      const res = await fetch('/api/ai/parse-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedImage ? 'image' : 'text',
          content: imageBase64 || ('This is my complete food log. Read Hindi, Hinglish, or English, understand the portions, and estimate nutrition for ALL items together. Keep the description faithful to what I wrote. Food log: ' + inputText.trim()),
          mediaType: selectedImage?.type,
          context: inputText.trim() || 'Identify the visible food, estimate the portion conservatively, and clearly state uncertainty.',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Nutrition extraction failed');
      if (!data.food || !data.food.description) throw new Error('AI did not return a food description. Try adding clearer quantities.');
      setParsedFood(data.food as ParsedFood);
      setSelectedQuantity(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process food. Please try again.');
    } finally {
      setParsing(false);
    }
  }

  async function searchManualFoods(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = manualQuery.trim();
    if (!query || manualLoading) return;

    setManualLoading(true);
    setError('');
    setManualFoods([]);
    setExternalFoods([]);
    try {
      const [savedResponse, databaseResponse] = await Promise.all([
        fetch('/api/my-foods?q=' + encodeURIComponent(query), { cache: 'no-store' }),
        fetch('/api/food/search?q=' + encodeURIComponent(query) + '&limit=8', { cache: 'no-store' }),
      ]);
      const savedBody = await savedResponse.json().catch(() => ({}));
      const databaseBody = await databaseResponse.json().catch(() => ({}));
      if (!savedResponse.ok && !databaseResponse.ok) {
        throw new Error(savedBody.error || databaseBody.error || 'Food search is unavailable.');
      }
      setManualFoods(savedResponse.ok ? (savedBody.foods || []) as ManualFood[] : []);
      setExternalFoods(databaseResponse.ok ? (databaseBody.results || []) as ExternalFood[] : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not search foods.');
    } finally {
      setManualLoading(false);
    }
  }

  function selectSavedFood(food: ManualFood) {
    setParsedFood({
      description: food.description,
      brand_name: food.brand_name,
      default_serving_size: food.default_serving_size,
      default_serving_unit: food.default_serving_unit,
      energy_kcal: food.energy_kcal,
      protein_g: food.protein_g,
      fat_g: food.fat_g,
      saturated_fat_g: null,
      carbs_g: food.carbs_g,
      fiber_g: food.fiber_g,
      sugar_g: food.sugar_g,
      sodium_mg: food.sodium_mg,
      cholesterol_mg: null,
      nutrient_values: food.nutrient_values,
      nutrient_source: food.nutrient_source || 'Saved food record',
      food_id: food.id,
      source: food.source || 'manual',
    });
    setSelectedQuantity(1);
    setInputText('');
    setSelectedImage(null);
    setError('');
  }

  function selectDatabaseFood(food: ExternalFood) {
    setParsedFood({
      description: food.description,
      brand_name: food.brand || null,
      default_serving_size: food.serving_size,
      default_serving_unit: food.serving_unit || 'serving',
      energy_kcal: food.calories,
      protein_g: food.protein_g,
      fat_g: food.fat_g,
      saturated_fat_g: null,
      carbs_g: food.carbs_g,
      fiber_g: food.fiber_g,
      sugar_g: food.sugar_g,
      sodium_mg: food.sodium_mg,
      cholesterol_mg: null,
      nutrient_values: food.nutrient_values || null,
      nutrient_source: food.nutrient_source || ('USDA FoodData Central (' + food.data_type + ')'),
      food_id: null,
      fdc_id: food.fdc_id,
      source: 'usda_fdc',
    });
    setSelectedQuantity(1);
    setInputText('');
    setSelectedImage(null);
    setError('');
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
          quantity: selectedQuantity,
          food: {
            food_id: parsedFood.food_id || null,
            fdc_id: parsedFood.fdc_id ?? null,
            description: parsedFood.description,
            source: parsedFood.source || 'ai-log',
            serving_size: parsedFood.default_serving_size || 1,
            serving_unit: parsedFood.default_serving_unit || 'serving',
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
      <p className="text-sm text-gray-500 mt-1 mb-5">Food ki photo upload karo ya apni language mein likho. Gemini estimate dega; save karne se pehle aap review karoge.</p>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <BookOpen size={19} className="text-brand-700" />
          <h2 className="font-semibold text-gray-900">Manual food search</h2>
        </div>
        <p className="mt-1 text-xs text-gray-500">Search your saved foods and the USDA food-composition database. No AI call is needed.</p>
        <form onSubmit={searchManualFoods} className="mt-3 flex gap-2">
          <input
            value={manualQuery}
            onChange={(event) => setManualQuery(event.target.value)}
            placeholder="e.g. paneer, oats, milk"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-3 text-base text-gray-900"
          />
          <button type="submit" disabled={manualLoading || !manualQuery.trim()} className="flex min-h-[48px] items-center gap-2 rounded-lg bg-brand-600 px-4 font-semibold text-white disabled:opacity-50">
            {manualLoading ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
            Search
          </button>
        </form>
        {(manualFoods.length > 0 || externalFoods.length > 0) && (
          <div className="mt-4 space-y-4">
            {manualFoods.length > 0 && <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Your food library</h3>
              <div className="space-y-2">
                {manualFoods.map((food) => <button key={food.id} type="button" onClick={() => selectSavedFood(food)} className="block w-full rounded-xl border border-gray-100 bg-gray-50 p-3 text-left active:bg-brand-50">
                  <span className="block font-semibold text-gray-900">{food.description}</span>
                  <span className="mt-1 block text-xs text-gray-500">{food.default_serving_size ?? 'Serving'} {food.default_serving_unit || ''} · {food.energy_kcal == null ? 'Energy unavailable' : food.energy_kcal + ' kcal'} · {food.nutrient_source || food.source || 'User food'}</span>
                </button>)}
              </div>
            </div>}
            {externalFoods.length > 0 && <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">USDA FoodData Central</h3>
              <div className="space-y-2">
                {externalFoods.map((food) => <button key={food.fdc_id} type="button" onClick={() => selectDatabaseFood(food)} className="block w-full rounded-xl border border-gray-100 bg-gray-50 p-3 text-left active:bg-brand-50">
                  <span className="block font-semibold text-gray-900">{food.description}</span>
                  <span className="mt-1 block text-xs text-gray-500">{food.brand || food.data_type} · {food.serving_size ?? 'Serving size not supplied'} {food.serving_unit || ''} · {food.calories == null ? 'Energy unavailable' : food.calories + ' kcal'}</span>
                </button>)}
              </div>
            </div>}
            <p className="text-[11px] text-gray-500">Choose a food to review its known nutrient values and portion before saving it to your diary.</p>
          </div>
        )}
        {!manualLoading && manualQuery.trim() && manualFoods.length === 0 && externalFoods.length === 0 && <p className="mt-3 text-sm text-gray-500">No search results found. Try another name or add a custom food in your Food Library.</p>}
        <a href="/my-foods/add" className="mt-3 inline-flex text-sm font-semibold text-brand-700 underline">Create a custom food</a>
      </section>

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
        <p className="text-xs text-gray-400 mt-1 mb-4">Quantity likhne se estimate behtar ho sakta hai. Example: “100g poha with peanuts”</p>
        <div className="mb-5 rounded-xl border border-dashed border-brand-300 bg-brand-50/60 p-4">
          <label htmlFor="food-photo" className="flex cursor-pointer items-center gap-2 font-semibold text-brand-700">
            <Camera size={20} /> Add food photo
          </label>
          <input id="food-photo" type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-sm text-gray-600" onChange={(event) => { const file = event.target.files?.[0] || null; setSelectedImage(file); setParsedFood(null); setError(''); }} />
          <p className="mt-1 text-xs text-gray-500">JPEG, PNG or WebP, maximum 3 MB. The photo is sent for analysis and is not saved to an image library.</p>
          {selectedImage && <div className="mt-2 flex items-center justify-between text-sm text-gray-700"><span className="truncate">{selectedImage.name}</span><button type="button" aria-label="Remove photo" onClick={() => setSelectedImage(null)} className="ml-2 rounded-lg p-2 text-gray-500"><X size={16} /></button></div>}
        </div>

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
          <button type="submit" disabled={parsing || (!inputText.trim() && !selectedImage)} className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-4 text-lg font-semibold text-white active:bg-brand-800 disabled:opacity-50 min-h-[54px]">
            {parsing ? <><Loader2 size={20} className="animate-spin" /> Processing food...</> : <><Sparkles size={20} /> Analyse Food</>}
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
            {parsedFood.source === 'usda_fdc' && <p className="mt-1 text-xs text-gray-500">FoodData Central result. Check the returned serving size and values before logging.</p>}
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
              <p className="mb-3 text-xs text-gray-500">Gemini estimates micronutrients from the food and portion you entered. Values are approximate, not lab-tested; when Gemini cannot make a reasonable estimate, the field stays unavailable.</p>
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
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <label className="block text-sm font-semibold text-gray-800">Portions to log
                <input type="number" min="0.25" max="1000" step="0.25" value={selectedQuantity} onChange={(event) => setSelectedQuantity(Math.max(0.25, Math.min(1000, Number(event.target.value) || 0.25)))} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900" />
              </label>
              <p className="mt-1 text-xs text-gray-500">Reference portion: {parsedFood.default_serving_size || 1} {parsedFood.default_serving_unit || 'serving'}. Nutrients scale by the portion count entered.</p>
            </div>
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
