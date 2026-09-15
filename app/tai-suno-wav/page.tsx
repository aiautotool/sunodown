import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Tải Suno WAV miễn phí | Suno Grab',
  description: 'Tải và chuyển bài hát Suno sang WAV trực tiếp trên trình duyệt. Phù hợp để lưu chất lượng cao hoặc tiếp tục chỉnh sửa audio.',
  alternates: { canonical: '/tai-suno-wav' },
};

export default function Page() {
  return <main className="min-h-screen bg-[#080812] px-5 py-16 text-white sm:px-8"><article className="mx-auto max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Suno WAV Downloader</p><h1 className="mt-3 text-4xl font-bold sm:text-5xl">Tải Suno WAV trên trình duyệt</h1><p className="mt-5 text-lg leading-8 text-white/65">Dán link bài hát Suno và chuyển audio sang WAV ngay trên thiết bị khi trình duyệt hỗ trợ. WAV phù hợp khi bạn muốn tiếp tục chỉnh sửa trong DAW hoặc phần mềm dựng video.</p><Link href="/" className="mt-8 inline-flex rounded-xl bg-cyan-500 px-5 py-3 font-bold text-black">Dán link và tải WAV</Link><section className="mt-12 space-y-5 text-white/65"><h2 className="text-2xl font-bold text-white">Cách tải WAV từ Suno</h2><p>Sao chép link Suno, dán vào Suno Grab, chờ hệ thống nhận diện bài hát rồi chọn nút “Tải WAV”. Quá trình chuyển đổi diễn ra trên trình duyệt.</p><h2 className="text-2xl font-bold text-white">Khi nào nên chọn WAV?</h2><p>WAV có dung lượng lớn hơn MP3 nhưng thuận tiện cho hậu kỳ, mix, master hoặc chỉnh sửa nhiều lần mà không cần nén lại ngay từ đầu.</p></section></article></main>;
}
