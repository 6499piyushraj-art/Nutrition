import { NextResponse } from 'next/server';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { validIsoDate } from '@/lib/nutrition-calculator';

export const dynamic = 'force-dynamic';

function csvCell(value: unknown): string {
  let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const format = params.get('format') || 'csv';
  if (format !== 'csv' && format !== 'json') return NextResponse.json({ error: 'format must be csv or json.' }, { status: 400 });

  const now = new Date();
  const today = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
  const from = params.get('from') || (() => { const date = new Date(today + 'T00:00:00.000Z'); date.setUTCDate(date.getUTCDate()-29); return date.toISOString().slice(0,10); })();
  const to = params.get('to') || today;
  if (!validIsoDate(from) || !validIsoDate(to) || from > to) return NextResponse.json({ error: 'Use a valid date range in YYYY-MM-DD format.' }, { status: 400 });
  const span = (new Date(to + 'T00:00:00.000Z').getTime() - new Date(from + 'T00:00:00.000Z').getTime()) / 86400000;
  if (span > 365) return NextResponse.json({ error: 'Export range cannot exceed 366 days.' }, { status: 400 });

  try {
    const rows = await db.select({
      date: schema.diaryEntries.date,
      meal: schema.diaryEntries.diaryMeal,
      food: schema.foods.description,
      quantity: schema.foodEntries.quantity,
      calories: schema.foodEntries.energyKcal,
      protein_g: schema.foodEntries.proteinG,
      carbs_g: schema.foodEntries.carbsG,
      fat_g: schema.foodEntries.fatG,
      fiber_g: schema.foodEntries.fiberG,
      sodium_mg: schema.foodEntries.sodiumMg,
      nutrients: schema.foodEntries.nutrientValues,
      source: schema.foodEntries.nutrientSource,
    }).from(schema.foodEntries)
      .innerJoin(schema.diaryEntries, eq(schema.foodEntries.diaryEntryId, schema.diaryEntries.id))
      .leftJoin(schema.foods, eq(schema.foodEntries.foodId, schema.foods.id))
      .where(and(
        eq(schema.diaryEntries.userId, session.user.id),
        eq(schema.diaryEntries.type, 'diary_meal'),
        gte(schema.diaryEntries.date, from),
        lte(schema.diaryEntries.date, to),
      )).orderBy(asc(schema.diaryEntries.date), asc(schema.diaryEntries.createdAt)).all();

    if (format === 'json') {
      return new NextResponse(JSON.stringify({ from, to, records: rows }, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="mynutri-food-history-${from}-${to}.json"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const columns = ['date','meal','food','quantity','calories','protein_g','carbs_g','fat_g','fiber_g','sodium_mg','nutrients','source'] as const;
    const lines = [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))];
    return new NextResponse(lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="mynutri-food-history-${from}-${to}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Could not prepare the requested export.' }, { status: 500 });
  }
}
