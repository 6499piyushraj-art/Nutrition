'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Trash2 } from 'lucide-react';

export default function DeleteAccountButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function deleteAccount() {
    if (confirmation !== 'DELETE' || !password || saving) return;
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/auth/delete-account', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not delete account.');
      router.replace('/login?reason=account-deleted');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete account.');
      setSaving(false);
    }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 font-semibold text-red-700">
      <Trash2 size={18}/> Delete account and data
    </button>
    {open && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="presentation" onClick={() => { if (!saving) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="delete-account-heading" className="w-full max-w-md rounded-t-2xl bg-white p-5 pb-8 shadow-xl sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2 text-red-700"><AlertTriangle size={20}/><h2 id="delete-account-heading" className="text-lg font-bold">Permanently delete account?</h2></div>
        <p className="mt-3 text-sm text-gray-600">This removes your profile, food logs, saved foods, recipes, measurements, and account data. This action cannot be undone. Export any records you need before continuing.</p>
        <label className="mt-4 block text-sm font-medium text-gray-700">Current password
          <input type="password" autoComplete="current-password" value={password} onChange={(event)=>setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-base text-gray-900"/>
        </label>
        <label className="mt-3 block text-sm font-medium text-gray-700">Type DELETE to confirm
          <input value={confirmation} onChange={(event)=>setConfirmation(event.target.value)} autoCapitalize="characters" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-base text-gray-900"/>
        </label>
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" disabled={saving} onClick={()=>setOpen(false)} className="min-h-[48px] rounded-lg border border-gray-300 px-3 py-2 font-medium text-gray-700">Cancel</button>
          <button type="button" disabled={saving || confirmation !== 'DELETE' || !password} onClick={()=>void deleteAccount()} className="min-h-[48px] rounded-lg bg-red-700 px-3 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Deleting…' : 'Delete permanently'}</button>
        </div>
      </section>
    </div>}
  </>;
}
