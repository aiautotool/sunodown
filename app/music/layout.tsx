import type { ReactNode } from 'react';
import { MusicGlobalProvider } from '@/components/music-global-player';

export default function MusicLayout({ children }: { children: ReactNode }) {
  return <MusicGlobalProvider>{children}</MusicGlobalProvider>;
}
