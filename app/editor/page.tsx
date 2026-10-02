import type { Metadata } from 'next';
import CreatorStudio from '@/components/creator-studio';

export const metadata: Metadata = {
  title: 'Creator Studio | SunoDown',
  description: 'Không gian chỉnh sửa riêng của SunoDown Creator Studio.',
  alternates: { canonical: '/editor' },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function EditorPage() {
  return <CreatorStudio initialView="create" initialAdvanced />;
}
