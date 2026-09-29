import type { Metadata } from 'next';
import CreatorStudio from '@/components/creator-studio';

export const metadata: Metadata = {
  title: 'Dự án | SunoDown',
  robots: { index: false, follow: false },
};

export default function ProjectsPage() {
  return <CreatorStudio initialView="projects" />;
}
