'use client';

import { Home, Library, Music2, PlusCircle, UserRound } from 'lucide-react';
import { usePathname } from 'next/navigation';

type Item = {
  href: string;
  label: string;
  icon: typeof Home;
  match: (pathname: string) => boolean;
  primary?: boolean;
};

const ITEMS: Item[] = [
  { href: '/', label: 'Home', icon: Home, match: (path) => path === '/' },
  { href: '/music', label: 'Music', icon: Music2, match: (path) => path.startsWith('/music') },
  { href: '/create', label: 'Create', icon: PlusCircle, match: (path) => path === '/create' || path.startsWith('/editor'), primary: true },
  { href: '/library', label: 'Library', icon: Library, match: (path) => path === '/library' },
  { href: '/settings', label: 'Me', icon: UserRound, match: (path) => path === '/settings' },
];

export function MobileAppNav() {
  const pathname = usePathname();

  return (
    <nav className="sd-mobile-app-nav" aria-label="Điều hướng mobile">
      {ITEMS.map(({ href, label, icon: Icon, match, primary }) => {
        const active = match(pathname || '/');
        return (
          <a
            key={href}
            href={href}
            className={[
              active ? 'active' : '',
              primary ? 'primary' : '',
            ].filter(Boolean).join(' ')}
            aria-current={active ? 'page' : undefined}
          >
            <span><Icon /></span>
            <b>{label}</b>
          </a>
        );
      })}
    </nav>
  );
}
