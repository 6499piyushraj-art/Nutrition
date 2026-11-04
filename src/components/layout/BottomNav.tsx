'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BookOpen, Camera, ChartColumnIncreasing, MoreHorizontal } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Today', icon: LayoutDashboard },
  { href: '/diary', label: 'Diary', icon: BookOpen },
  { href: '/photo-scanner', label: 'Scan', icon: Camera },
  { href: '/analysis', label: 'Analysis', icon: ChartColumnIncreasing },
  { href: '/more', label: 'More', icon: MoreHorizontal },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-2 ${
                active ? 'text-brand-600' : 'text-gray-400'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] mt-0.5 font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
      {/* Safe area padding for iOS */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
