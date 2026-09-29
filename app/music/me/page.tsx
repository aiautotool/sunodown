import type { Metadata } from 'next';
import { MusicHub } from '@/components/music-hub';

export const metadata: Metadata = {
  title: 'Music của tôi | SunoDown',
  description: 'Playlist, bài yêu thích, Top 20 và lịch sử nghe cá nhân trên SunoDown Music.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  alternates: { canonical: '/music/me' },
};

export default function MyMusicPage() {
  return (
    <main className="sd-music-page">
      <MusicHub />
    </main>
  );
}
