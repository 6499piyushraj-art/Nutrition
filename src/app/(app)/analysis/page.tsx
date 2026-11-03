'use client';

import { useEffect, useState } from 'react';
import { NUTRIENT_SPECS } from '@/lib/nutrients';

type Nutrient = { value: number | null; status: string; knownFoods: number; totalFoods: number; };
type Summary = { period: string; from: string; to: string; days: Array<{ date: string; foodsLogged: number; nutrition: Record<string, Nutrient> }>; averages: Record<string, Nutrient>; };

function fmt(value: number | null, unit: string) { return value == null ? 'Data incomplete' : `${Math.round(value * 100) / 100} ${unit}`; }

export default function AnalysisPage() {
  const [period, setPeriod] = useState('7d');
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    fetch('/api/v1/diary/summary/' + period, { cache: 'no-store', credentials: 'same-origin' })
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
        </>
      )}
    </section>
  );
}
