'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Save, SlidersHorizontal } from 'lucide-react';
import { NUTRIENT_SPECS, getDefaultNutrientTargets, type NutrientConfidence, type NutrientStatus, type NutrientTargets } from '@/lib/nutrients';

interface NutrientSummary { value: number | null; status: NutrientStatus; confidence: NutrientConfidence; knownFoods: number; totalFoods: number; }
interface ApiData { date: string; targets: NutrientTargets; nutrition: Record<string, NutrientSummary>; foodsLogged: number; }
type Key = keyof NutrientTargets;

function fmt(value: number, unit: string) {
  const whole = unit === 'kcal' || unit === 'mg';
  const rounded = Math.round(value * (whole ? 1 : 100)) / (whole ? 1 : 100);
  return rounded.toLocaleString(undefined, { maximumFractionDigits: whole ? 0 : 2 }) + ' ' + unit;
}
function confidenceLabel(confidence: NutrientConfidence) {
  switch (confidence) {
    case 'database': return 'Food-composition database value';
    case 'estimated': return 'AI-estimated value';
    case 'mixed': return 'Mixed database and estimated values';
    case 'user-entered': return 'User-entered value';
    default: return 'Source not identified';
  }
}

export default function NutrientTracker() {
  const [data, setData] = useState<ApiData | null>(null);
  const [draft, setDraft] = useState<NutrientTargets>(() => getDefaultNutrientTargets());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/nutrients?_t=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Could not load nutrient summary');
      setData(result as ApiData); setDraft(result.targets as NutrientTargets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load nutrient summary');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function saveTargets(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setSaved(false);
    try {
      const res = await fetch('/api/nutrients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targets: draft }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Could not save targets');
      setDraft(result.targets as NutrientTargets); setEditing(false); setSaved(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save targets');
    } finally { setSaving(false); }
  }

  const macroEnergy = useMemo(() => draft.protein * 4 + draft.carbs * 4 + draft.fat * 9, [draft]);
  const calorieGap = draft.calories - macroEnergy;
  const macroWarning = Math.abs(calorieGap) >= 50;

  function card(key: Key) {
    const spec = NUTRIENT_SPECS.find((item) => item.key === key)!;
    const result = data?.nutrition[key];
    const status = result?.status || 'unavailable';
    let valueText = 'Data unavailable';
    if (status === 'no_food') valueText = 'No food logged';
    else if (status === 'complete' && result?.value !== null && result?.value !== undefined) valueText = fmt(result.value, spec.unit);
    return (
      <div key={key} className="min-w-0 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
        <p className="text-xs font-medium text-gray-500">{spec.label}</p>
        <p className="mt-1 break-words text-lg font-bold text-gray-900">{valueText}</p>
        <p className="mt-1 text-xs text-gray-400">{('isLimit' in spec && spec.isLimit) ? 'Reference limit: ≤ ' + fmt(draft[key], spec.unit) : 'Target: ' + fmt(draft[key], spec.unit)}</p>
        {status === 'partial' && result && <p className="mt-1 text-xs text-amber-700">Incomplete data ({result.knownFoods}/{result.totalFoods} foods); daily total unavailable.</p>}
        {status === 'complete' && result && <p className="mt-1 text-[11px] text-gray-400">{confidenceLabel(result.confidence)}</p>}
      </div>
    );
  }

  const macroSpecs = NUTRIENT_SPECS.filter((item) => item.group === 'macro');
  const essentialSpecs = NUTRIENT_SPECS.filter((item) => item.group === 'essential');

  return (
    <section className="mt-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Daily Nutrient Dashboard</h2>
          <p className="mt-1 text-xs text-gray-500">Targets are configurable reference values, not personalized medical prescriptions.</p>
        </div>
        <button onClick={() => void load()} aria-label="Refresh nutrient summary" className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-gray-200 p-2 text-gray-600"><RefreshCw size={17} /></button>
      </div>
      {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {saved && <p className="text-sm text-green-700">Daily targets saved.</p>}
      {loading && !data ? <p className="py-6 text-center text-sm text-gray-500">Loading nutrient data…</p> : (
        <>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-gray-800">Energy & Macronutrients</h3>
            <p className="mb-3 mt-1 text-xs text-gray-500">A nutrient total is shown only when every logged food has a value for it.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{macroSpecs.map((spec) => card(spec.key as Key))}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="mb-1 font-semibold text-gray-800">Essential Micronutrients</h3>
            <p className="mb-3 text-xs text-gray-500">Only known food-composition values are counted. Gemini meal parsing does not invent micronutrient values.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{essentialSpecs.map((spec) => card(spec.key as Key))}</div>
          </div>
          {macroWarning && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Calorie consistency check</p>
            <p className="mt-1">Your macro targets provide about {Math.round(macroEnergy).toLocaleString()} kcal (protein × 4 + carbs × 4 + fat × 9), {Math.round(Math.abs(calorieGap)).toLocaleString()} kcal {calorieGap > 0 ? 'below' : 'above'} your {Math.round(draft.calories).toLocaleString()} kcal target. No target was changed automatically.</p>
          </div>}
          <details open={editing} className="rounded-2xl bg-white p-4 shadow-sm">
            <summary onClick={(event) => { event.preventDefault(); setEditing((current) => !current); }} className="flex cursor-pointer list-none items-center gap-2 font-semibold text-gray-800">
              <SlidersHorizontal size={18} /> Edit daily targets {editing ? <ChevronUp size={18} className="ml-auto" /> : <ChevronDown size={18} className="ml-auto" />}
            </summary>
            {editing && <form onSubmit={saveTargets} className="mt-4 space-y-4">
              <p className="text-xs text-gray-500">Edit any target. These general reference values are not medical prescriptions.</p>
              {(['macro', 'essential'] as const).map((group) => (
                <div key={group}>
                  <h4 className="mb-2 text-sm font-semibold text-gray-700">{group === 'macro' ? 'Energy & macros' : 'Essential micronutrients'}</h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {NUTRIENT_SPECS.filter((spec) => spec.group === group).map((spec) => (
                      <label key={spec.key} className="block text-sm text-gray-700">
                        <span className="flex items-baseline justify-between gap-2"><span className="font-medium">{spec.label}{('isLimit' in spec && spec.isLimit) ? ' limit' : ''}</span><span className="text-xs text-gray-500">{spec.unit}</span></span>
                        <input type="number" min="0" step="any" required value={draft[spec.key as Key]}
                          onChange={(event) => { const value = event.target.value === '' ? 0 : Number(event.target.value); setDraft((prev) => ({ ...prev, [spec.key]: value })); setSaved(false); }}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200" />
                        {'targetHint' in spec && spec.targetHint && <span className="mt-1 block text-xs text-gray-500">{spec.targetHint}</span>}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white disabled:opacity-50"><Save size={17} /> {saving ? 'Saving…' : 'Save targets'}</button>
                <button type="button" onClick={() => { setDraft(data?.targets || getDefaultNutrientTargets()); setEditing(false); }} className="rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">Cancel</button>
              </div>
            </form>}
          </details>
        </>
      )}
    </section>
  );
}
