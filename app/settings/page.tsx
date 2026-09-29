import type { Metadata } from 'next';
import CreatorStudio from '@/components/creator-studio';

export const metadata: Metadata = {
  title: 'Tài khoản & cài đặt | SunoDown',
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return <CreatorStudio initialView="settings" />;
}
