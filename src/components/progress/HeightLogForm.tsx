'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ruler, Loader2 } from 'lucide-react';

function localDate() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
}

export default function HeightLogForm() {
  const router = useRouter();
  const [height, setHeight] = useState('');
  const [date, setDate] = useState(localDate());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const value = Number(height);
    if (!Number.isFinite(value) || value < 50 || value > 260) {
      setError('Enter a height between 50 and 260 cm.');
      return;
    }
    setSaving(true); setError(''); setSaved(false);
    try {
      const response = await fetch('/api/measurements/log-height', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ height_cm: value, date }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not save measurement.');
      setSaved(true);
      setHeight('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save measurement.');
    } finally {
      setSaving(false);
    }
  }

  return <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
    <div className="flex items-center gap-2"><Ruler size={19} className="text-brand-700"/><h2 className="font-semibold text-gray-900">Record height</h2></div>
    <p className="text-xs text-gray-500">Optional private measurement history. This does not predict future height or rate anyone’s body.</p>
    <label className="block text-sm font-medium text-gray-700">Height (cm)
      <input type="number" min="50" max="260" step="0.1" inputMode="decimal" required value={height} onChange={(event)=>setHeight(event.target.value)} placeholder="e.g. 165" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-base text-gray-900"/>
    </label>
    <label className="block text-sm font-medium text-gray-700">Measurement date
      <input type="date" required max={localDate()} value={date} onChange={(event)=>setDate(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-base text-gray-900"/>
    </label>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {saved && <p role="status" className="text-sm text-green-700">Height measurement saved.</p>}
    <button type="submit" disabled={saving || !height} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white disabled:opacity-50">
      {saving ? <><Loader2 size={17} className="animate-spin"/> Saving…</> : 'Save height'}
    </button>
  </form>;
}
