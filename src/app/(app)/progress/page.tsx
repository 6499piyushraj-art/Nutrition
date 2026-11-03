import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, schema } from '@/lib/db';
import { and, asc, eq } from 'drizzle-orm';
import { isUnder18OrUnknown } from '@/lib/nutrition-calculator';


export const dynamic = 'force-dynamic';

type MeasurementRecord = { id: string; date: string; type: string; value: number; unit: string | null };

export default async function ProgressPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const profile = await db.select({ dateOfBirth: schema.healthProfiles.dateOfBirth })
    .from(schema.healthProfiles).where(eq(schema.healthProfiles.userId, session.user.id)).get();
  const restricted = isUnder18OrUnknown(profile?.dateOfBirth);
  const conditions = [eq(schema.measurements.userId, session.user.id)];
  if (restricted) conditions.push(eq(schema.measurements.type, 'height'));
  const records: MeasurementRecord[] = await db.select({
    id: schema.measurements.id,
    date: schema.measurements.date,
    type: schema.measurements.type,
    value: schema.measurements.value,
    unit: schema.measurements.unit,
  }).from(schema.measurements).where(and(...conditions))
    .orderBy(asc(schema.measurements.date)).limit(180).all() as MeasurementRecord[];

  return (
    <section className="space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Growth & Measurements</h1>
        <p className="mt-1 text-sm text-gray-500">Optional, private records. This app does not predict adult height or diagnose health conditions.</p>
      </div>
      {restricted && <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
        Weight-goal tools are disabled for younger users and for accounts without a saved birth date. Growth varies from person to person; discuss concerns with a qualified health professional.
      </div>}
      {records.length ? <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-gray-900">Saved measurements</h2>
        <div className="mt-3 space-y-2">{records.map((record) => (
          <div key={record.id} className="flex items-center justify-between border-t border-gray-100 pt-2 text-sm">
            <span className="text-gray-700">{record.date} · {record.type === 'height' ? 'Height' : 'Weight'}</span>
            <span className="font-semibold text-gray-900">{record.value} {record.unit}</span>
          </div>
        ))}</div>
      </div> : <div className="rounded-xl bg-white p-6 text-sm text-gray-500 shadow-sm">No measurement history saved.</div>}
    </section>
  );
}
