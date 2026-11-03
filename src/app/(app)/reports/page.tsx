'use client';

import { useState } from 'react';

function today() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}
function daysAgo(value: string, amount: number) {
  const d = new Date(value + 'T00:00:00.000Z'); d.setUTCDate(d.getUTCDate()-amount); return d.toISOString().slice(0,10);
}

export default function ReportsPage() {
  const current = today();
  const [from, setFrom] = useState(daysAgo(current, 29));
  const [to, setTo] = useState(current);
  const [kind, setKind] = useState<'food' | 'measurements' | 'all'>('food');
  const [error, setError] = useState('');

  function exportFile(format: 'csv' | 'json') {
    setError('');
    if (from > to) { setError('Start date must be before or equal to end date.'); return; }
    const span = (new Date(to + 'T00:00:00Z').getTime() - new Date(from + 'T00:00:00Z').getTime()) / 86400000;
    if (span > 365) { setError('Choose a period of 366 days or less.'); return; }
    window.location.href = `/api/v1/reports/export?kind=${kind}&format=${format}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  }

  return <section className="space-y-4 pb-24">
    <div><h1 className="text-2xl font-bold text-gray-900">Reports & Export</h1><p className="mt-1 text-sm text-gray-500">Download your food history, measurements or a full account backup.</p></div>
    <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
      <label className="block text-sm font-medium text-gray-700">Export type
        <select value={kind} onChange={(event)=>setKind(event.target.value as 'food' | 'measurements' | 'all')} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-base text-gray-900">
          <option value="food">Food history</option><option value="measurements">Height and weight measurements</option><option value="all">Full account backup (JSON)</option>
        </select>
      </label>
      <label className="block text-sm font-medium text-gray-700">From<input type="date" value={from} max={today()} disabled={kind === 'all'} onChange={(e)=>setFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3"/></label>
      <label className="block text-sm font-medium text-gray-700">To<input type="date" value={to} max={today()} disabled={kind === 'all'} onChange={(e)=>setTo(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3"/></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={()=>exportFile('csv')} className="min-h-[48px] rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white">Export CSV</button>
        <button onClick={()=>exportFile('json')} className="min-h-[48px] rounded-lg border border-gray-300 px-4 py-3 font-semibold text-gray-700">Export JSON</button>
      </div>
      <button onClick={()=>window.print()} className="min-h-[44px] w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700">Print this page / Save as PDF</button>
    </div>
    <p className="text-xs text-gray-500">Food and measurement exports use the selected date range. Full account backup includes all dates and all user-owned app records, but excludes passwords and authentication tokens. Unknown food nutrients remain blank.</p>
  </section>;
}
