'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';

interface ProfileData {
  id?: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  sex?: string;
  height_ft?: number;
  height_in?: number;
  starting_weight_lbs?: number;
  current_weight_lbs?: number;
  goal_weight_lbs?: number;
  goal_target_date?: string;
  activity_level?: string;
  weekly_goal?: string;
  daily_calorie_goal?: number;
  goal_protein_g?: number;
  goal_carbs_g?: number;
  goal_fat_g?: number;
  goal_fiber_g?: number;
  goal_sodium_mg?: number;
  goal_sugar_g?: number;
  goal_water_oz?: number;
  daily_step_goal?: number;
  unit_system?: string;
  meal_names?: string[];
}

interface Props {
  profile: ProfileData | null;
  userId: string;
  userEmail: string;
  userName: string;
  isMinor?: boolean;
}

export default function ProfileForm({ profile, userId, userEmail, userName, isMinor = false }: Props) {
  const [form, setForm] = useState({
    date_of_birth: profile?.date_of_birth || '',
    sex: profile?.sex || '',
    height_ft: profile?.height_ft?.toString() || '',
    height_in: profile?.height_in?.toString() || '',
    starting_weight_lbs: profile?.starting_weight_lbs?.toString() || '',
    current_weight_lbs: profile?.current_weight_lbs?.toString() || '',
    goal_weight_lbs: profile?.goal_weight_lbs?.toString() || '',
    goal_target_date: profile?.goal_target_date || '',
    activity_level: profile?.activity_level || 'sedentary',
    weekly_goal: profile?.weekly_goal || 'Lose 1 lb per week',
    daily_calorie_goal: profile?.daily_calorie_goal?.toString() || '2400',
    goal_protein_g: profile?.goal_protein_g?.toString() || '80',
    goal_carbs_g: profile?.goal_carbs_g?.toString() || '300',
    goal_fat_g: profile?.goal_fat_g?.toString() || '75',
    goal_fiber_g: profile?.goal_fiber_g?.toString() || '30',
    goal_sodium_mg: profile?.goal_sodium_mg?.toString() || '2300',
    goal_sugar_g: profile?.goal_sugar_g?.toString() || '50',
    goal_water_oz: profile?.goal_water_oz?.toString() || '',
    daily_step_goal: profile?.daily_step_goal?.toString() || '',
    unit_system: profile?.unit_system || 'imperial',
  });


  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      const body: Record<string, unknown> = {
        user: userId,
        date_of_birth: form.date_of_birth || null,
        sex: form.sex || null,
        height_ft: form.height_ft ? parseInt(form.height_ft) : null,
        height_in: form.height_in ? parseInt(form.height_in) : null,
        starting_weight_lbs: form.starting_weight_lbs ? parseFloat(form.starting_weight_lbs) : null,
        current_weight_lbs: form.current_weight_lbs ? parseFloat(form.current_weight_lbs) : null,
        goal_weight_lbs: form.goal_weight_lbs ? parseFloat(form.goal_weight_lbs) : null,
        goal_target_date: (() => {
          const c = parseFloat(form.current_weight_lbs) || 0;
          const g = parseFloat(form.goal_weight_lbs) || 0;
          const rMap: Record<string, number> = { 'Lose 2 lbs per week': 2, 'Lose 1.5 lbs per week': 1.5, 'Lose 1 lb per week': 1, 'Lose 0.5 lb per week': 0.5, 'Gain 0.5 lb per week': 0.5, 'Gain 1 lb per week': 1 };
          const r = rMap[form.weekly_goal] || 0;
          if (c > 0 && g > 0 && r > 0 && Math.abs(c - g) > 0) {
            const t = new Date(); t.setDate(t.getDate() + Math.ceil(Math.abs(c - g) / r) * 7);
            return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
          }
          return null;
        })(),
        activity_level: form.activity_level || null,
        weekly_goal: form.weekly_goal || null,
        goal_water_oz: form.goal_water_oz ? parseFloat(form.goal_water_oz) : null,
        daily_step_goal: form.daily_step_goal ? parseInt(form.daily_step_goal) : null,
        unit_system: form.unit_system || 'imperial',
      };

      const res = await fetch('/api/profile/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profile?.id, ...body }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to save');
        return;
      }

      setSaved(true);
    } catch {
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Account info */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-3">Account</h2>
        <div className="space-y-1 text-sm">
          <p><span className="text-gray-500">Name:</span> <span className="text-gray-900">{userName || 'Not set'}</span></p>
          <p><span className="text-gray-500">Email:</span> <span className="text-gray-900">{userEmail}</span></p>
        </div>
      </div>

      {/* About Me */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-3">About Me</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date of Birth</label>
            <input type="date" value={form.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sex</label>
            <select value={form.sex} onChange={(e) => update('sex', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Select</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Height (ft)</label>
              <input type="number" value={form.height_ft} onChange={(e) => update('height_ft', e.target.value)}
                placeholder="5" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Height (in)</label>
              <input type="number" value={form.height_in} onChange={(e) => update('height_in', e.target.value)}
                min="0" max="11" placeholder="10" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Activity Level</label>
            <select value={form.activity_level} onChange={(e) => update('activity_level', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="sedentary">Sedentary (little or no exercise)</option>
              <option value="lightly_active">Lightly Active (1-3 days/week)</option>
              <option value="active">Active (3-5 days/week)</option>
              <option value="very_active">Very Active (6-7 days/week)</option>
            </select>
          </div>
        </div>
      </div>

      {!isMinor && (
        <>
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-3">Weight Journey</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Starting</label>
              <input type="number" step="0.1" value={form.starting_weight_lbs} onChange={(e) => update('starting_weight_lbs', e.target.value)}
                placeholder="200" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Current</label>
              <input type="number" step="0.1" value={form.current_weight_lbs} onChange={(e) => update('current_weight_lbs', e.target.value)}
                placeholder="195" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Goal</label>
              <input type="number" step="0.1" value={form.goal_weight_lbs} onChange={(e) => update('goal_weight_lbs', e.target.value)}
                placeholder="175" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Weekly Goal</label>
            <select value={form.weekly_goal} onChange={(e) => update('weekly_goal', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="Lose 2 lbs per week">Lose 2 lbs/week</option>
              <option value="Lose 1.5 lbs per week">Lose 1.5 lbs/week</option>
              <option value="Lose 1 lb per week">Lose 1 lb/week</option>
              <option value="Lose 0.5 lb per week">Lose 0.5 lb/week</option>
              <option value="Maintain">Maintain</option>
              <option value="Gain 0.5 lb per week">Gain 0.5 lb/week</option>
              <option value="Gain 1 lb per week">Gain 1 lb/week</option>
            </select>
          </div>
          {(() => {
            const current = parseFloat(form.current_weight_lbs) || 0;
            const goal = parseFloat(form.goal_weight_lbs) || 0;
            const rateMap: Record<string, number> = {
              'Lose 2 lbs per week': 2, 'Lose 1.5 lbs per week': 1.5,
              'Lose 1 lb per week': 1, 'Lose 0.5 lb per week': 0.5,
              'Gain 0.5 lb per week': 0.5, 'Gain 1 lb per week': 1,
            };
            const rate = rateMap[form.weekly_goal] || 0;
            const diff = Math.abs(current - goal);
            if (current > 0 && goal > 0 && rate > 0 && diff > 0) {
              const weeks = Math.ceil(diff / rate);
              const target = new Date();
              target.setDate(target.getDate() + weeks * 7);
              const targetStr = `${String(target.getMonth() + 1).padStart(2, '0')}/${String(target.getDate()).padStart(2, '0')}/${target.getFullYear()}`;
              return (
                <div className="bg-brand-50 rounded-lg p-3 mt-2">
                  <p className="text-sm text-brand-800">
                    <span className="font-semibold">Target date: {targetStr}</span>
                    <span className="text-brand-600 ml-1">({weeks} weeks / {Math.round(weeks / 4.3)} months)</span>
                  </p>
                  <p className="text-xs text-brand-500 mt-1">
                    {current > goal ? `Lose ${diff.toFixed(1)} lbs` : `Gain ${diff.toFixed(1)} lbs`} at {rate} lb/week
                  </p>
                </div>
              );
            }
            if (form.weekly_goal === 'Maintain') {
              return (
                <div className="bg-green-50 rounded-lg p-3 mt-2">
                  <p className="text-sm text-green-700 font-medium">Maintaining current weight</p>
                </div>
              );
            }
            return null;
          })()}
        </div>
      </div>


        </>
      )}

      {/* Daily Habits */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-1">Daily Habits</h2>
        <p className="mb-3 text-xs text-gray-500">Optional personal reminders. These are not nutrition prescriptions or exercise requirements.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Water reminder (oz)</label>
            <input type="number" min="0" max="1000" step="any" value={form.goal_water_oz} onChange={(e) => update('goal_water_oz', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Step reminder</label>
            <input type="number" min="0" max="100000" step="1" value={form.daily_step_goal} onChange={(e) => update('daily_step_goal', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-3">Preferences</h2>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Unit System</label>
          <select value={form.unit_system} onChange={(e) => update('unit_system', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="imperial">Imperial (lbs, oz, ft)</option>
            <option value="metric">Metric (kg, ml, cm)</option>
          </select>
        </div>
      </div>

      {/* Save button */}
      {error && <div className="bg-red-50 text-red-700 text-base rounded-lg p-3">{error}</div>}

      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-lg font-semibold min-h-[52px] ${
          saved
            ? 'bg-green-600 text-white'
            : 'bg-brand-600 text-white active:bg-brand-800 disabled:opacity-50'
        }`}
      >
        <Save size={20} />
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Profile'}
      </button>
    </div>
  );
}
