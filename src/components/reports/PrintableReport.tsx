'use client';

import { useEffect, useState } from 'react';

type ReportRecord = Record<string, unknown>;
type ExportResponse = { kind: string; from: string; to: string; records?: ReportRecord[] };

function label(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function printableValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function PrintableReport({
  kind,
  from,
  to,
}: {
  kind: 'food' | 'measurements';
  from: string;
  to: string;
}) {
  const [data, setData] = useState<ExportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ kind, format: 'json', from, to });
    fetch('/api/v1/reports/export?' + query.toString(), {
      cache: 'no-store',
      credentials: 'same-origin',
    })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Could not prepare this report.');
        return result as ExportResponse;
      })
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Could not prepare this report.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, from, to]);

  const records = data?.records || [];
  const columns = records.length ? Object.keys(records[0]) : [];

  return (
    <main className="mx-auto max-w-6xl space-y-5 bg-white p-4 text-gray-900 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">MyNutri</p>
          <h1 className="mt-1 text-2xl font-bold">Printable {kind === 'food' ? 'Food History' : 'Measurement'} Report</h1>
          <p className="mt-1 text-sm text-gray-500">{from} to {to}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.history.back()} className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">Back</button>
          <button type="button" onClick={() => window.print()} disabled={!data || loading || !!error} className="min-h-[44px] rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Print / Save as PDF</button>
        </div>
      </div>

      <header className="hidden border-b border-gray-300 pb-4 print:block">
        <p className="text-xs font-semibold uppercase tracking-widest">MyNutri</p>
        <h1 className="mt-1 text-2xl font-bold">{kind === 'food' ? 'Food History' : 'Measurement History'}</h1>
        <p className="mt-1 text-sm">{from} to {to}</p>
      </header>

      {loading ? <p className="py-12 text-center text-gray-500">Preparing your report…</p> : null}
      {error ? <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}

      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
            <span>{records.length} record{records.length === 1 ? '' : 's'}</span>
            <span>Generated {new Date().toLocaleString()}</span>
          </div>
          {!records.length ? <p className="rounded-xl bg-gray-50 p-8 text-center text-sm text-gray-500">No records were found in this date range.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left text-xs print:min-w-0 print:text-[9px]">
                <thead>
                  <tr className="border-b-2 border-gray-400 bg-gray-50 print:bg-white">
                    {columns.map((column) => <th key={column} className="px-2 py-2 font-semibold">{label(column)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, index) => (
                    <tr key={String(record.id ?? index)} className="break-inside-avoid border-b border-gray-200">
                      {columns.map((column) => (
                        <td key={column} className="max-w-[260px] break-words px-2 py-2 align-top">
                          {printableValue(record[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="hidden pt-4 text-[9px] text-gray-500 print:block">
            Food values retain their recorded source. Blank or unavailable nutrient values are not treated as zero.
          </p>
        </>
      )}

      <style jsx global>{`
        @page { size: A4 landscape; margin: 10mm; }
        @media print {
          body { background: #fff !important; }
          main { max-width: none !important; padding: 0 !important; }
          tr { break-inside: avoid; }
        }
      `}</style>
    </main>
  );
}
