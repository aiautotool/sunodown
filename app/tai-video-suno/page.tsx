import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Tải video Suno MP4 miễn phí | Suno Grab',
  description: 'Tải video Suno hoặc tạo video visualizer MP4 từ bài hát Suno. Hỗ trợ 9:16, 16:9, 1:1 cho TikTok, Reels, Shorts và YouTube.',
  alternates: { canonical: '/tai-video-suno' },
};

export default function Page() {
  return <main className="min-h-screen bg-[#080812] px-5 py-16 text-white sm:px-8"><article className="mx-auto max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-fuchsia-300">Suno Video Downloader</p><h1 className="mt-3 text-4xl font-bold sm:text-5xl">Tải video Suno hoặc tạo visualizer MP4</h1><p className="mt-5 text-lg leading-8 text-white/65">Dán link Suno để tải video gốc khi có sẵn, hoặc tạo video mới từ cover, title, waveform và lyrics. Có preset dọc 9:16 cho TikTok, Reels, Shorts và ngang 16:9 cho YouTube.</p><Link href="/" className="mt-8 inline-flex rounded-xl bg-fuchsia-500 px-5 py-3 font-bold">Dán link và tải video</Link><section className="mt-12 space-y-5 text-white/65"><h2 className="text-2xl font-bold text-white">Video Suno có những lựa chọn nào?</h2><p>Nếu bài hát có video gốc, bạn có thể tải trực tiếp. Nếu không, Visualizer Studio cho phép tạo video mới với nhiều template, waveform và tỉ lệ màn hình.</p><h2 className="text-2xl font-bold text-white">Phù hợp cho TikTok và YouTube</h2><p>Chọn 9:16 cho TikTok, Reels, Shorts; 16:9 cho YouTube; 1:1 hoặc 4:5 cho bài đăng mạng xã hội.</p></section></article></main>;
}
