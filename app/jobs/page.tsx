import type { Metadata } from 'next';
import CreatorStudio from '@/components/creator-studio';

export const metadata: Metadata = {
  title: 'Jobs | SunoDown',
  robots: { index: false, follow: false },
};

export default function JobsPage() {
  return <CreatorStudio initialView="jobs" />;
}
