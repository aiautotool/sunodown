import type { Metadata } from 'next';
import { AdminAnalyticsDashboard } from '@/components/admin-analytics-dashboard';

export const metadata: Metadata = {
  title: 'SunoDown Internal Analytics',
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminAnalyticsPage() {
  return <AdminAnalyticsDashboard />;
}
