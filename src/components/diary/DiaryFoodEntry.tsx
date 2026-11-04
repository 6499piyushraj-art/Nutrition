'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Trash2, Plus, Minus, Pencil, Check } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { FoodEntryData } from '@/app/(app)/diary/[date]/page';

interface Props {
  entry: FoodEntryData;
  diaryEntryId: string;
  date: string;
  isMinor?: boolean;
}

export default function DiaryFoodEntry({ entry, diaryEntryId, date, isMinor = true }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(entry.quantity);
  const [saving, setSaving] = useState(false);

  const isDeleted = !entry.food;
  const foodName = entry.food?.description || 'Deleted food';
  const brandName = entry.food?.brand_name;
  const basePerServing = entry.food;

  const displayQty = editing ? qty : entry.quantity;
  const scale = (value: number | null | undefined): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? Math.round(value * qty * 10) / 10 : null;
  const shown = (value: number | null | undefined, digits = 1): string =>
    typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value * (10 ** digits)) / (10 ** digits)) : '—';

  const cal = editing && basePerServing ? scale(basePerServing.energy_kcal) : entry.energy_kcal;
  const pro = editing && basePerServing ? scale(basePerServing.protein_g) : entry.protein_g;
  const carb = editing && basePerServing ? scale(basePerServing.carbs_g) : entry.carbs_g;
  const fat = editing && basePerServing ? scale(basePerServing.fat_g) : entry.fat_g;
  const fiber = editing && basePerServing ? scale(basePerServing.fiber_g) : entry.fiber_g;
  const sodium = editing && basePerServing ? scale(basePerServing.sodium_mg) : entry.sodium_mg;
  const sugar = editing && basePerServing ? scale(basePerServing.sugar_g) : entry.sugar_g;

  // If the food has been deleted, show a simplified view with its saved values.
  if (isDeleted) {
    return (
      <div className="px-4 py-3 flex items-center justify-between bg-red-50/50">
        <div className="flex-1">
          <p className="text-sm text-red-400 italic">Deleted food</p>
          {!isMinor && <p className="text-xs text-gray-400">{shown(entry.energy_kcal, 0)} cal · {entry.quantity} serving{entry.quantity !== 1 ? 's' : ''}</p>}
          <p className="text-xs text-gray-500">Nutrition details are unavailable because the source food was deleted.</p>
        </div>
        <button
          onClick={() => setShowDelete(true)}
          className="text-red-500 text-xs font-medium flex items-center gap-1 min-h-[44px] px-2"
        >
          <Trash2 size={14} />
          Remove
        </button>
        <ConfirmDialog
          open={showDelete}
          title="Remove deleted food?"
          message="This food no longer exists. Remove this entry from your diary?"
          confirmLabel={deleting ? 'Removing...' : 'Remove'}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      </div>
    );
  }

  const servingInfo = entry.food?.default_serving_size
    ? `${entry.food.default_serving_size}${entry.food.default_serving_unit ? ` ${entry.food.default_serving_unit}` : ''}`
    : null;

  async function saveQuantity() {
    setSaving(true);
    try {
      const res = await fetch('/api/diary/update-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foodEntryId: entry.id, diaryEntryId, quantity: qty }),
      });
      if (res.ok) {
        setEditing(false);
        window.location.reload();
      }
    } catch {
      // Silent fail
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setQty(entry.quantity);
    setEditing(false);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch('/api/diary/delete-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foodEntryId: entry.id, diaryEntryId }),
      });
      if (res.ok) {
        setShowDelete(false);
        window.location.reload();
      }
    } catch {
      // Silent fail
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="px-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full py-3 flex items-center justify-between min-h-[52px] text-left"
      >
        <div className="flex-1 min-w-0 pr-3">
          <p className="font-medium text-gray-900 text-base truncate">{foodName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {brandName && (
              <span className="text-xs text-gray-400">{brandName}</span>
            )}
            <span className="text-xs text-gray-500">
              {displayQty} serving{displayQty !== 1 ? 's' : ''}{servingInfo ? ` (${servingInfo})` : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isMinor && <span className="text-sm font-medium text-orange-600">{shown(cal, 0)} cal</span>}
          {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="pb-3 -mt-1">
          {/* Serving editor */}
          {editing ? (
            <div className="bg-brand-50 rounded-lg p-3 mb-3 border border-brand-200">
              <p className="text-sm font-medium text-gray-700 mb-2">Adjust servings</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty(Math.max(0.25, qty - 0.25))}
                  className="w-10 h-10 rounded-full bg-white border border-gray-300 flex items-center justify-center active:bg-gray-100"
                >
                  <Minus size={16} />
                </button>
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(Math.max(0.25, parseFloat(e.target.value) || 0.25))}
                  step="0.25"
                  min="0.25"
                  className="w-20 text-center text-xl font-bold border-2 border-gray-300 rounded-lg py-1.5 text-gray-900"
                />
                <button
                  onClick={() => setQty(qty + 0.25)}
                  className="w-10 h-10 rounded-full bg-white border border-gray-300 flex items-center justify-center active:bg-gray-100"
                >
                  <Plus size={16} />
                </button>
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={cancelEdit}
                    className="border border-gray-300 text-gray-600 rounded-lg px-3 py-2 text-sm font-medium active:bg-gray-100 min-h-[40px]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveQuantity}
                    disabled={saving || qty === entry.quantity}
                    className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 active:bg-brand-800 min-h-[40px] flex items-center gap-1"
                  >
                    <Check size={16} />
                    {saving ? '...' : 'Save'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">{!isMinor && <>{shown(cal, 0)} cal · </>}P {shown(pro)}g · C {shown(carb)}g · F {shown(fat)}g</p>
            </div>
          ) : null}

          {/* Macro breakdown */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="grid grid-cols-3 gap-y-2 text-sm">
              <div className="text-center">
                <p className="font-semibold text-blue-600">{shown(pro)}g</p>
                <p className="text-[10px] text-gray-500">protein</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-green-600">{shown(carb)}g</p>
                <p className="text-[10px] text-gray-500">carbs</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-purple-600">{shown(fat)}g</p>
                <p className="text-[10px] text-gray-500">fat</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-700">{shown(fiber)}g</p>
                <p className="text-[10px] text-gray-500">fiber</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-700">{shown(sugar)}g</p>
                <p className="text-[10px] text-gray-500">sugar</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-700">{shown(sodium, 0)}mg</p>
                <p className="text-[10px] text-gray-500">sodium</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3">
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 text-xs text-brand-600 font-medium min-h-[44px] px-2"
                >
                  <Pencil size={14} />
                  Edit serving
                </button>
              )}
              {entry.food && (
                <a
                  href={`/my-foods/${entry.food.id}?from=/diary/${date}`}
                  className="text-xs text-gray-500 font-medium min-h-[44px] flex items-center px-2"
                >
                  View food
                </a>
              )}
            </div>
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-1 text-xs text-red-500 font-medium min-h-[44px] px-2"
            >
              <Trash2 size={14} />
              Remove
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDelete}
        title="Remove from diary?"
        message={`Remove ${foodName} from this meal? This won't delete the food from My Foods.`}
        confirmLabel={deleting ? 'Removing...' : 'Remove'}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
