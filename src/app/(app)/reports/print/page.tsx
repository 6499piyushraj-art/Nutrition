import { redirect } from 'next/navigation';
import PrintableReport from '@/components/reports/PrintableReport';
import { validIsoDate } from '@/lib/nutrition-calculator';

type Props = {
  searchParams: Promise<{ kind?: string; from?: string; to?: string }>;
};

export default async function ReportsPrintPage({ searchParams }: Props) {
  const params = await searchParams;
  const kind = params.kind === 'measurements' ? 'measurements' : 'food';
  if (!params.from || !params.to || !validIsoDate(params.from) || !validIsoDate(params.to) || params.from > params.to) {
    redirect('/reports');
  }
  const span = (new Date(params.to + 'T00:00:00.000Z').getTime() - new Date(params.from + 'T00:00:00.000Z').getTime()) / 86400000;
  if (span > 365) redirect('/reports');
  return <PrintableReport kind={kind} from={params.from} to={params.to} />;
}
