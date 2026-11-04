import BottomNav from '@/components/layout/BottomNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fbf8ef] pb-20 print:bg-white print:pb-0">
      <main className="max-w-lg mx-auto px-4 pt-4 print:max-w-none print:px-0 print:pt-0">{children}</main>
      <div className="print:hidden"><BottomNav /></div>
    </div>
  );
}
