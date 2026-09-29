import type { Metadata } from 'next';
import CreatorStudio from '@/components/creator-studio';

export const metadata: Metadata = {
  title: 'Tạo nội dung mới | SunoDown',
  robots: { index: false, follow: false },
};

export default function CreatePage() {
  return <CreatorStudio initialView="create" />;
}
