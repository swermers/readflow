'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Newspaper, Archive, Rss, Settings, LogOut, Sun, Moon, StickyNote, BookMarked,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';
import { useTheme } from './ThemeProvider';

export const refreshSidebar = () => {
  window.dispatchEvent(new CustomEvent('sidebar-refresh'));
};

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { theme, toggleTheme } = useTheme();

  const [senders, setSenders] = useState<any[]>([]);

  const loadData = async () => {
    const { data } = await supabase
      .from('senders')
      .select('id, name')
      .eq('status', 'approved')
      .order('name');

    if (data) setSenders(data);
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    const handleRefresh = () => loadData();
    window.addEventListener('sidebar-refresh', handleRefresh);
    return () => window.removeEventListener('sidebar-refresh', handleRefresh);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const isActive = (path: string) => pathname === path;
  const isActiveSender = (id: string) => pathname === `/sender/${id}`;

  const navItems: NavItem[] = [
    { href: '/', label: 'The Rack', icon: <Newspaper className="w-[18px] h-[18px]" /> },
    { href: '/library', label: 'Library', icon: <BookMarked className="w-[18px] h-[18px]" /> },
    { href: '/archive', label: 'Archive', icon: <Archive className="w-[18px] h-[18px]" /> },
    { href: '/notes', label: 'Notes', icon: <StickyNote className="w-[18px] h-[18px]" /> },
    { href: '/subscriptions', label: 'Sources', icon: <Rss className="w-[18px] h-[18px]" /> },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`
          w-[260px] h-screen flex flex-col fixed left-0 top-0 z-40
          border-r transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        `}
        style={{
          background: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
        }}
      >

        <div className="px-6 pt-7 pb-6">
          <Link href="/" className="flex items-center gap-2.5 group" onClick={onClose}>
            <div className="h-2 w-2 rounded-full bg-accent shadow-[0_0_0_4px_rgba(230,57,45,0.12)]" />
            <span className="text-lg font-black uppercase tracking-[0.06em] text-ink">
              Readflow
            </span>
          </Link>
        </div>

        <nav className="px-3 space-y-0.5">
          <div className="px-3 mb-3">
            <span className="text-label uppercase tracking-[0.16em] text-ink-faint">Navigate</span>
          </div>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`
                flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-150
                ${isActive(item.href)
                  ? 'bg-[var(--sidebar-active-bg)] text-ink'
                  : 'text-ink-muted hover:text-ink hover:bg-[var(--sidebar-active-bg)]'
                }
              `}
            >
              <span className={isActive(item.href) ? 'text-accent' : ''}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto thin-scrollbar mt-8 px-3">
          <div className="px-3 mb-3">
            <span className="text-label uppercase tracking-[0.16em] text-ink-faint">Newsletters</span>
          </div>
          <div className="space-y-0.5">
            {senders.map((sender) => (
              <Link
                key={sender.id}
                href={`/sender/${sender.id}?view=library`}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2 text-sm rounded-xl transition-all duration-150
                  ${isActiveSender(sender.id)
                    ? 'bg-[var(--sidebar-active-bg)] text-ink'
                    : 'text-ink-muted hover:text-ink hover:bg-[var(--sidebar-active-bg)]'
                  }
                `}
              >
                <div className="w-6 h-6 rounded-md bg-surface-overlay flex items-center justify-center text-[10px] font-bold text-ink-faint flex-shrink-0">
                  {sender.name[0]}
                </div>
                <span className="truncate">{sender.name}</span>
              </Link>
            ))}
            {senders.length === 0 && (
              <p className="px-3 py-4 text-xs text-ink-faint text-center">
                No sources yet. Sync Gmail to get started.
              </p>
            )}
          </div>
        </div>

        <div className="p-3 space-y-0.5" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-ink-muted hover:text-ink rounded-xl hover:bg-[var(--sidebar-active-bg)] transition-all duration-150 w-full"
          >
            {theme === 'light' ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>

          <Link
            href="/settings"
            onClick={onClose}
            className={`
              flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-150
              ${isActive('/settings')
                ? 'bg-[var(--sidebar-active-bg)] text-ink'
                : 'text-ink-muted hover:text-ink hover:bg-[var(--sidebar-active-bg)]'
              }
            `}
          >
            <Settings className="w-[18px] h-[18px]" />
            Settings
          </Link>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-ink-muted hover:text-accent rounded-xl hover:bg-[var(--sidebar-active-bg)] transition-all duration-150 w-full"
          >
            <LogOut className="w-[18px] h-[18px]" />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
