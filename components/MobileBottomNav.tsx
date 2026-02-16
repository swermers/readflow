'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Archive, Newspaper, Rss, Shield } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Rack', icon: Newspaper },
  { href: '/review', label: 'Gate', icon: Shield },
  { href: '/archive', label: 'Vault', icon: Archive },
  { href: '/subscriptions', label: 'Sources', icon: Rss },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-xl items-center justify-around px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;

          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex min-w-[68px] flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] transition-colors ${
                  active ? 'text-accent' : 'text-ink-faint hover:text-ink-muted'
                }`}
              >
                <Icon className={`h-[17px] w-[17px] ${active ? 'stroke-[2.4]' : ''}`} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
