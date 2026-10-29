'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Settings, BookOpen, Plus } from 'lucide-react';
import LogWeightButton from '@/components/dashboard/LogWeightButton';
import NutrientTracker from '@/components/dashboard/NutrientTracker';

interface DashboardData {
  user: { first_name: string | null; last_name: string | null };
  profile: {
    daily_calorie_goal: number | null;
    goal_protein_g: number | null;
    goal_carbs_g: number | null;
    goal_fat_g: number | null;
  } | null;
  totals: { calories: number; protein: number; carbs: number; fat: number };
  hasProfile: boolean;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const now = new Date();
        const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const res = await fetch(`/api/dashboard?date=${localDate}&_t=${Date.now()}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });

        // A redeploy on ephemeral SQLite can invalidate an old login cookie.
        // Clear stale cookies and send the user to sign in instead of showing a dead dashboard.
        if (res.status === 401) {
          try {
            await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' });
          } catch {
            // Continue to login even if the logout request cannot be completed.
          }
          window.location.replace('/login?reason=session-expired&redirect=%2Fdashboard');
          return;
        }

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Dashboard request failed (${res.status})`);
        }

        setData(await res.json());
        setLoadError('');
      } catch (error) {
        console.error('[dashboard] Failed to load dashboard data:', error);
        setLoadError(error instanceof Error ? error.message : 'Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-700 font-medium">Could not load dashboard</p>
        <p className="text-sm text-gray-500 mt-2">
          {loadError || 'Your session may have expired, or the server could not be reached.'}
        </p>
        <div className="flex justify-center gap-3 mt-5">
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-brand-600 text-white px-4 py-2.5 font-medium"
          >
            Try again
          </button>
          <Link
            href="/login?redirect=%2Fdashboard"
            className="rounded-lg border border-gray-300 text-gray-700 px-4 py-2.5 font-medium"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <img src="/tally-mark.svg" alt="Tally" className="w-10 h-10" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              Hi, {data.user.first_name || 'there'}
            </h1>
            <p className="text-xs text-gray-500">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <Link href="/profile" className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200">
          <Settings size={20} className="text-gray-500" />
        </Link>
      </div>

      <NutrientTracker />

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/diary" className="bg-white rounded-xl p-4 shadow-sm text-center active:bg-gray-50 min-h-[72px] flex flex-col items-center justify-center">
          <BookOpen size={24} className="text-brand-600 mb-1" />
          <span className="text-sm font-medium text-gray-700">Food Diary</span>
        </Link>
        <Link href="/diary/add-food" className="bg-white rounded-xl p-4 shadow-sm text-center active:bg-gray-50 min-h-[72px] flex flex-col items-center justify-center">
          <Plus size={24} className="text-brand-600 mb-1" />
          <span className="text-sm font-medium text-gray-700">Log Food</span>
        </Link>
        <LogWeightButton />
      </div>

      {/* Setup prompt if no profile */}
      {!data.hasProfile && (
        <div className="mt-4 bg-brand-50 border border-brand-200 rounded-xl p-4">
          <p className="text-sm font-medium text-brand-800">Set up your profile</p>
          <p className="text-xs text-brand-600 mt-1">Add your goals and targets to personalize your dashboard.</p>
          <Link href="/profile" className="inline-block mt-2 text-sm font-semibold text-brand-700 active:text-brand-900">
            Go to Profile &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
