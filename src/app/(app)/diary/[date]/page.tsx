'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DiaryFoodEntry from '@/components/diary/DiaryFoodEntry';
import DiaryDateNav from '@/components/diary/DiaryDateNav';
import JournalSection from '@/components/diary/JournalSection';

interface FoodEntryData {
  id: string;
  quantity: number;
  energy_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sodium_mg: number | null;
  sugar_g: number | null;
  food: {
    id: string;
    description: string;
    brand_name: string | null;
    energy_kcal: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    default_serving_size: number | null;
    default_serving_unit: string | null;
  } | null;
}

interface DiaryEntry {
  id: string;
  diary_meal: string;
  total_calories: number | null;
  total_protein_g: number | null;
  total_carbs_g: number | null;
  total_fat_g: number | null;
  food_entries: FoodEntryData[];
}

export { type FoodEntryData };

export default function DiaryDatePage() {
  const params = useParams();
  const date = params.date as string;
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    async function loadDiary() {
      setLoading(true);
      setLoadError('');
      try {
        const res = await fetch('/api/diary/' + date + '?_t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) {
          if (res.status === 401) {
            window.location.replace('/login?redirect=%2Fdiary');
            return;
          }
          throw new Error('Could not load food log (' + res.status + ')');
        }
        const data = await res.json();
        setEntries(data.entries || []);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Please try again.');
      } finally {
        setLoading(false);
      }
    }
    loadDiary();
  }, [date]);

  const allFoodEntries = entries.flatMap((entry) =>
    entry.food_entries.map((foodEntry) => ({
      foodEntry,
      diaryEntryId: entry.id,
    })),
  );

  const dayCal = entries.reduce((sum, entry) => sum + (entry.total_calories || 0), 0);
  const dayPro = entries.reduce((sum, entry) => sum + (entry.total_protein_g || 0), 0);
  const dayCarb = entries.reduce((sum, entry) => sum + (entry.total_carbs_g || 0), 0);
  const dayFat = entries.reduce((sum, entry) => sum + (entry.total_fat_g || 0), 0);

  const parts = date.split('-').map(Number);
  const year = parts[0], month = parts[1], day = parts[2];
  const d = new Date(year, month - 1, day);
  const prev = new Date(year, month - 1, day - 1);
  const next = new Date(year, month - 1, day + 1);
  const fmt = (dt: Date) => String(dt.getFullYear()) + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  const now = new Date();
  const todayStr = fmt(now);
  const isToday = date === todayStr;

  return (
    <div>
      <DiaryDateNav
        date={date}
        prevDate={fmt(prev)}
        nextDate={fmt(next)}
        isToday={isToday}
        displayLabel={isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        displayDate={String(month).padStart(2, '0') + '/' + String(day).padStart(2, '0') + '/' + year}
      />

      {dayCal > 0 && (
        <div className="grid grid-cols-4 gap-2 text-center mb-4">
          <div className="bg-orange-50 rounded-lg p-2">
            <p className="text-lg font-bold text-orange-600">{Math.round(dayCal)}</p>
            <p className="text-[10px] text-gray-500">cal</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2">
            <p className="text-lg font-bold text-blue-600">{Math.round(dayPro)}g</p>
            <p className="text-[10px] text-gray-500">protein</p>
          </div>
          <div className="bg-green-50 rounded-lg p-2">
            <p className="text-lg font-bold text-green-600">{Math.round(dayCarb)}g</p>
            <p className="text-[10px] text-gray-500">carbs</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-2">
            <p className="text-lg font-bold text-purple-600">{Math.round(dayFat)}g</p>
            <p className="text-[10px] text-gray-500">fat</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Food Log</h2>
            <p className="text-xs text-gray-500 mt-0.5">Hindi, Hinglish ya English mein food likhkar log karo</p>
          </div>
          <Link
            href={'/diary/add-food?date=' + date}
            className="bg-brand-600 text-white rounded-lg px-3 py-2 text-sm font-semibold min-h-[40px] flex items-center justify-center"
          >
            + Log Food
          </Link>
        </div>

        {loading ? (
          <p className="text-center text-gray-500 py-8">Loading food log...</p>
        ) : loadError ? (
          <div className="p-4">
            <p className="text-sm text-red-600">{loadError}</p>
            <button onClick={() => window.location.reload()} className="mt-3 text-sm font-semibold text-brand-600">Try again</button>
          </div>
        ) : allFoodEntries.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {allFoodEntries.map(({ foodEntry, diaryEntryId }) => (
              <DiaryFoodEntry key={foodEntry.id} entry={foodEntry} diaryEntryId={diaryEntryId} date={date} />
            ))}
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <div className="text-3xl mb-2">🍲</div>
            <p className="font-semibold text-gray-800">Abhi kuch log nahi hua</p>
            <p className="text-sm text-gray-500 mt-1">Jaise: “2 roti, ek katori dal aur ek glass doodh”</p>
            <Link href={'/diary/add-food?date=' + date} className="inline-flex mt-4 rounded-lg bg-brand-600 px-5 py-3 text-white font-semibold">
              Log my food
            </Link>
          </div>
        )}
      </div>

      <JournalSection date={date} />
    </div>
  );
}
