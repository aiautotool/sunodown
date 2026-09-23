import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Tải Suno MP3 miễn phí | Suno Grab',
  description: 'Tải bài hát Suno sang MP3 trực tiếp trên trình duyệt. Dán liên kết Suno, chuyển âm thanh sang MP3 và lưu về điện thoại hoặc máy tính.',
  alternates: { canonical: '/tai-suno-mp3' },
};

export default function Page() {
  return <main className="min-h-screen bg-[#080812] px-5 py-16 text-white sm:px-8"><article className="mx-auto max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-300">Tải nhạc Suno MP3</p><h1 className="mt-3 text-4xl font-bold sm:text-5xl">Tải Suno MP3 miễn phí</h1><p className="mt-5 text-lg leading-8 text-white/65">Sao chép liên kết bài hát Suno rồi dùng Suno Grab để tạo file MP3 phù hợp cho nghe offline, gửi qua ứng dụng chat hoặc nhập vào phần mềm chỉnh sửa âm thanh.</p><Link href="/" className="mt-8 inline-flex rounded-xl bg-violet-500 px-5 py-3 font-bold">Dán liên kết và tải MP3</Link><section className="mt-12 space-y-5 text-white/65"><h2 className="text-2xl font-bold text-white">Cách tải MP3 từ Suno</h2><p>1. Mở bài hát Suno và sao chép liên kết chia sẻ. 2. Quay lại Suno Grab và dán liên kết. 3. Chờ hệ thống nhận diện bài hát. 4. Chọn “Tải MP3”.</p><h2 className="text-2xl font-bold text-white">MP3 khác gì WAV?</h2><p>MP3 có dung lượng nhỏ, tiện nghe và chia sẻ. WAV thường phù hợp hơn khi cần tiếp tục hậu kỳ hoặc chỉnh sửa âm thanh.</p></section></article></main>;
}
