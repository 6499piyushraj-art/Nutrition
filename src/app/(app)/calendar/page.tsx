'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Food = { id: string; description: string | null; quantity: number; unit: string | null; calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; };
type Meal = { id: string; meal: string; foods: Food[]; };
type DayData = { date: string; meals: Meal[]; foodsLogged: number; };

function today() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}
function display(value: number | null, suffix: string) {
  return value == null ? '—' : `${Math.round(value * 10) / 10}${suffix}`;
}

export default function CalendarPage() {
  const [date, setDate] = useState(today());
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    fetch('/api/v1/diary/' + date, { cache: 'no-store', credentials: 'same-origin' })
      .then(async (res) => { const result = await res.json().catch(() => ({})); if (!res.ok) throw new Error(result.error || 'Could not load this day'); return result as DayData; })
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Could not load this day'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date]);

  return (
    <section className="space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendar & History</h1>
        <p className="mt-1 text-sm text-gray-500">Choose a date to review saved meals and food records.</p>
      </div>
      <label className="block rounded-xl bg-white p-4 shadow-sm">
        <span className="mb-2 block text-sm font-semibold text-gray-700">Select date</span>
        <input type="date" value={date} max={today()} onChange={(event) => setDate(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base text-gray-900" />
      </label>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <p className="py-8 text-center text-gray-500">Loading food history…</p> : data && (
        <>
          <div className="rounded-xl bg-brand-50 p-4">
            <p className="text-sm text-brand-800">{data.foodsLogged} food item{data.foodsLogged === 1 ? '' : 's'} recorded</p>
          </div>
          {data.meals.length ? data.meals.map((meal) => (
            <article key={meal.id} className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-gray-900">{meal.meal}</h2>
              <div className="mt-3 space-y-3">
                {meal.foods.map((food) => (
                  <div key={food.id} className="border-t border-gray-100 pt-3 first:border-0 first:pt-0">
                    <p className="font-medium text-gray-800">{food.description || 'Saved food'}</p>
                    <p className="mt-1 text-xs text-gray-500">{food.quantity} {food.unit || 'serving'} · {display(food.calories, ' kcal')} · P {display(food.protein_g, ' g')} · C {display(food.carbs_g, ' g')} · F {display(food.fat_g, ' g')}</p>
                  </div>
                ))}
              </div>
              <Link href={`/diary/add-food?date=${date}`} className="mt-3 inline-block text-sm font-semibold text-brand-700">Add another food</Link>
            </article>
          )) : <div className="rounded-xl bg-white p-6 text-center text-sm text-gray-500">No meals saved on this date.</div>}
        </>
      )}
    </section>
  );
}
