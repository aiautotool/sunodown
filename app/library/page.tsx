import type { Metadata } from 'next';
import CreatorStudio from '@/components/creator-studio';

export const metadata: Metadata = {
  title: 'Thư viện | SunoDown',
  robots: { index: false, follow: false },
};

export default function LibraryPage() {
  return <CreatorStudio initialView="library" />;
}
