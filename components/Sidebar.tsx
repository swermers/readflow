'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Newspaper, Archive, Rss, Settings, LogOut, Sun, Moon, StickyNote, BookMarked, X,
} from 'lucide-react';
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
  const { theme, toggleTheme } = useTheme();

  const handleSignOut = async () => {
    // lazy import to keep this component light
    const { createClient } = await import('@/utils/supabase/client');
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const isActive = (path: string) => pathname === path;

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
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`
          fixed left-0 top-0 z-40 flex h-screen w-[260px] flex-col border-r
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        `}
        style={{
          background: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
        }}
      >
        <div className="flex items-center justify-end gap-2 px-3 pb-3 pt-3 md:hidden">
          <Link
            href="/settings"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-muted transition-colors hover:border-accent hover:text-accent"
            aria-label="Open settings"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>
          <button
            onClick={toggleTheme}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-muted transition-colors hover:border-accent hover:text-accent"
            aria-label={theme === 'light' ? 'Enable dark mode' : 'Enable light mode'}
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-muted transition-colors hover:border-accent hover:text-accent"
            aria-label="Close menu"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="hidden px-6 pb-6 pt-7 md:block">
          <Link href="/" className="group flex items-center gap-2.5" onClick={onClose}>
            <div className="h-2 w-2 rounded-full bg-accent shadow-[0_0_0_4px_rgba(230,57,45,0.12)]" />
            <span className="text-lg font-black uppercase tracking-[0.06em] text-ink">Readflow</span>
          </Link>
        </div>

        <nav className="hidden px-3 md:block">
          <div className="mb-3 px-3">
            <span className="text-label uppercase tracking-[0.16em] text-ink-faint">Navigate</span>
          </div>
          <div className="space-y-0.5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150
                  ${isActive(item.href)
                    ? 'bg-[var(--sidebar-active-bg)] text-ink'
                    : 'text-ink-muted hover:bg-[var(--sidebar-active-bg)] hover:text-ink'
                  }
                `}
              >
                <span className={isActive(item.href) ? 'text-accent' : ''}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="mt-auto space-y-0.5 p-3" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          <button
            onClick={toggleTheme}
            className="hidden w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-muted transition-all duration-150 hover:bg-[var(--sidebar-active-bg)] hover:text-ink md:flex"
          >
            {theme === 'light' ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>

          <Link
            href="/settings"
            onClick={onClose}
            className={`
              hidden items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 md:flex
              ${isActive('/settings')
                ? 'bg-[var(--sidebar-active-bg)] text-ink'
                : 'text-ink-muted hover:bg-[var(--sidebar-active-bg)] hover:text-ink'
              }
            `}
          >
            <Settings className="h-[18px] w-[18px]" />
            Settings
          </Link>

          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-muted transition-all duration-150 hover:bg-[var(--sidebar-active-bg)] hover:text-accent"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
