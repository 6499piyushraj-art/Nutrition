'use client';

import { useEffect, useState } from 'react';
import { NUTRIENT_SPECS } from '@/lib/nutrients';

type Nutrient = { value: number | null; status: string; knownFoods: number; totalFoods: number; };
type Contributors = {
  date: string;
  nutrient: { key: string; label: string; unit: string };
  value: number | null;
  status: string;
  knownFoods: number;
  totalFoods: number;
  contributors: Array<{ id: string; meal: string; food: string; value: number | null; source: string | null; quantity: number }>;
};
type Summary = { period: string; from: string; to: string; days: Array<{ date: string; foodsLogged: number; nutrition: Record<string, Nutrient> }>; averages: Record<string, Nutrient>; };

function localIsoDate() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

function fmt(value: number | null, unit: string) { return value == null ? 'Data incomplete' : `${Math.round(value * 100) / 100} ${unit}`; }

export default function AnalysisPage() {
  const [period, setPeriod] = useState('7d');
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedNutrient, setSelectedNutrient] = useState('protein');
  const [contributorDate, setContributorDate] = useState(localIsoDate());
  const [contributorData, setContributorData] = useState<Contributors | null>(null);
  const [contributorLoading, setContributorLoading] = useState(true);
  const [contributorError, setContributorError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    fetch('/api/v1/diary/summary/' + period + '?endDate=' + localIsoDate(), { cache: 'no-store', credentials: 'same-origin' })
      .then(async (res) => { const result = await res.json().catch(() => ({})); if (!res.ok) throw new Error(result.error || 'Could not load analysis'); return result as Summary; })
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Could not load analysis'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period]);

  return (
    <section className="space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nutrient Analysis</h1>
        <p className="mt-1 text-sm text-gray-500">Historical averages from saved foods. Incomplete data is shown as incomplete, not zero.</p>
      </div>
      <label className="block rounded-xl bg-white p-4 shadow-sm">
        <span className="mb-2 block text-sm font-semibold text-gray-700">Time range</span>
        <select value={period} onChange={(event) => setPeriod(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base text-gray-900">
          <option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option>
        </select>
      </label>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <p className="py-8 text-center text-gray-500">Calculating averages…</p> : data && (
        <>
          <p className="text-xs text-gray-500">{data.from} to {data.to} · {data.days.length} days with logged food</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {NUTRIENT_SPECS.filter((spec) => spec.key !== 'calories').map((spec) => {
              const item = data.averages[spec.key];
              const value = item?.status === 'complete' ? fmt(item.value, spec.unit) : 'Data incomplete';
              return <article key={spec.key} className="rounded-xl bg-white p-3 shadow-sm">
                <p className="text-xs text-gray-500">{spec.label}</p>
                <p className="mt-1 break-words text-lg font-bold text-gray-900">{value}</p>
                <p className="mt-1 text-[11px] text-gray-400">{item?.status === 'complete' ? 'Average per logged day' : `${item?.knownFoods || 0}/${item?.totalFoods || 0} known food values`}</p>
              </article>;
            })}
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-gray-900">Daily logging history</h2>
            {data.days.length ? <div className="mt-3 space-y-2">{data.days.map((day) => (
              <div key={day.date} className="flex items-center justify-between border-t border-gray-100 pt-2 text-sm">
                <span className="text-gray-700">{day.date}</span><span className="text-gray-500">{day.foodsLogged} item{day.foodsLogged === 1 ? '' : 's'}</span>
              </div>
            ))}</div> : <p className="mt-2 text-sm text-gray-500">No food history for this period.</p>}
          </div>

          <section className="rounded-xl bg-white p-4 shadow-sm">
            <div>
              <h2 className="font-semibold text-gray-900">Food contributions</h2>
              <p className="mt-1 text-xs text-gray-500">See which saved foods contributed a nutrient on a specific date.</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-gray-600">Nutrient
                <select value={selectedNutrient} onChange={(event) => setSelectedNutrient(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900">
                  {NUTRIENT_SPECS.map((spec) => <option key={spec.key} value={spec.key}>{spec.label}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-gray-600">Date
                <input type="date" value={contributorDate} max={localIsoDate()} onChange={(event) => setContributorDate(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900" />
              </label>
            </div>
            {contributorError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{contributorError}</p>}
            {contributorLoading ? <p className="py-6 text-center text-sm text-gray-500">Loading food contributions…</p> : contributorData && (
              <>
                <div className="mt-3 rounded-lg bg-brand-50 p-3">
                  <p className="text-xs text-brand-800">{contributorData.nutrient.label} total · {contributorDate}</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">
                    {contributorData.status === 'complete'
                      ? fmt(contributorData.value, contributorData.nutrient.unit)
                      : contributorData.status === 'no_food' ? 'No food logged' : 'Total incomplete'}
                  </p>
                  {contributorData.status === 'partial' || contributorData.status === 'unavailable'
                    ? <p className="mt-1 text-xs text-gray-600">{contributorData.knownFoods} of {contributorData.totalFoods} foods have this nutrient recorded. Missing values are not counted as zero.</p>
                    : null}
                </div>
                {contributorData.contributors.length ? (
                  <div className="mt-3 divide-y divide-gray-100">
                    {contributorData.contributors.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{item.food}</p>
                          <p className="mt-0.5 text-xs text-gray-500">{item.meal} · {item.quantity} serving multiplier{item.source ? ' · ' + item.source : ''}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-gray-800">{item.value === null ? 'Not available' : fmt(item.value, contributorData.nutrient.unit)}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-3 text-sm text-gray-500">No food was logged on this date.</p>}
              </>
            )}
          </section>
        </>
      )}
    </section>
  );
}
