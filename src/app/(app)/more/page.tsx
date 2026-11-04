import Link from 'next/link';
import { CalendarDays, BookOpen, FileText, Settings, TrendingUp, Camera, Apple } from 'lucide-react';

const links = [
  { href: '/calendar', title: 'Calendar & History', description: 'Browse saved meals by date.', icon: CalendarDays },
  { href: '/my-foods', title: 'Food Library', description: 'Search and manage your foods.', icon: Apple },
  { href: '/reports', title: 'Reports & Export', description: 'Export your own food history.', icon: FileText },
  { href: '/progress', title: 'Growth & Measurements', description: 'Optional measurement history.', icon: TrendingUp },
  { href: '/profile', title: 'Settings & Profile', description: 'Account, preferences and nutrient targets.', icon: Settings },
  { href: '/meals', title: 'Saved Meals', description: 'View your saved meal collections.', icon: BookOpen },
  { href: '/photo-scanner', title: 'Photo Scanner', description: 'Review food photo estimates before saving.', icon: Camera },
];

export default function MorePage() {
  return <section className="space-y-4 pb-24">
    <div><h1 className="text-2xl font-bold text-gray-900">More</h1><p className="mt-1 text-sm text-gray-500">Tools and account features.</p></div>
    <div className="space-y-2">{links.map(({href,title,description,icon:Icon}) => <Link key={href} href={href} className="flex min-h-[76px] items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700"><Icon size={20}/></span>
      <span className="min-w-0"><span className="block font-semibold text-gray-900">{title}</span><span className="mt-0.5 block text-xs text-gray-500">{description}</span></span>
    </Link>)}</div>
  </section>;
}
