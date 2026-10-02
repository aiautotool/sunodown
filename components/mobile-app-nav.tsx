'use client';

import { Download, Home, Library, PlusCircle, UserRound } from 'lucide-react';
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
  { href: '/tai-suno-mp3', label: 'Tải', icon: Download, match: (path) => path.startsWith('/tai-suno-') },
  { href: '/create', label: 'Creator', icon: PlusCircle, match: (path) => path === '/create' || path.startsWith('/editor'), primary: true },
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
