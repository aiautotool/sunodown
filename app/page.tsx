import V4SafePage from '@/components/v4/page-safe';
import { V5DownloadEnhancer } from '@/components/v5/download-enhancer';
import { V5PresetGalleryEnhancer } from '@/components/v5/preset-gallery-enhancer';

const faq = [
  { question: 'Cách tải nhạc Suno về điện thoại?', answer: 'Sao chép liên kết bài hát Suno, dán vào ô trên trang, chờ hệ thống nhận diện bài hát rồi chọn MP3, WAV, M4A, video, ảnh bìa hoặc lyrics để lưu.' },
  { question: 'Có thể tải Suno MP3, WAV và M4A không?', answer: 'Có. Suno Grab hỗ trợ tải M4A và chuyển đổi sang MP3 hoặc WAV trực tiếp trên trình duyệt khi thiết bị hỗ trợ.' },
  { question: 'Có thể tải video Suno không?', answer: 'Có. Bạn có thể tải video gốc khi bài hát có video hoặc tạo video visualizer với nhiều tỉ lệ và template khác nhau.' },
  { question: 'Có tải được ảnh bìa và lyrics Suno không?', answer: 'Có. Khi dữ liệu có sẵn, Suno Grab cho phép lưu ảnh bìa, lyrics dạng TXT và metadata của bài hát.' },
  { question: 'Tải nhạc Suno có cần cài ứng dụng không?', answer: 'Không. Công cụ chạy trực tiếp trên trình duyệt và phù hợp cho cả điện thoại lẫn máy tính.' },
];

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication', name: 'Suno Grab', url: 'https://suno.aiautotool.com/', applicationCategory: 'MultimediaApplication', operatingSystem: 'Web', inLanguage: 'vi',
      description: 'Công cụ tải nhạc Suno MP3, WAV, M4A, video, ảnh bìa, lyrics và tạo video visualizer trực tiếp trên trình duyệt.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'VND' },
      featureList: ['Tải Suno MP3', 'Tải Suno WAV', 'Tải Suno M4A', 'Tải video Suno', 'Tải ảnh bìa', 'Tải lyrics', 'Tạo video visualizer nhiều preset'],
    },
    { '@type': 'HowTo', name: 'Cách tải nhạc Suno', step: [
      { '@type': 'HowToStep', position: 1, name: 'Sao chép link Suno', text: 'Mở bài hát trên Suno và sao chép liên kết chia sẻ.' },
      { '@type': 'HowToStep', position: 2, name: 'Dán link', text: 'Dán liên kết Suno vào ô tải nhạc.' },
      { '@type': 'HowToStep', position: 3, name: 'Chọn định dạng', text: 'Chọn MP3, WAV, M4A, video, ảnh bìa hoặc lyrics.' },
      { '@type': 'HowToStep', position: 4, name: 'Lưu về thiết bị', text: 'Tải file về điện thoại hoặc máy tính.' },
    ]},
    { '@type': 'FAQPage', mainEntity: faq.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) },
  ],
};

export default function Page() {
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <section className="bg-[#080812] px-5 pt-12 text-white sm:px-8 sm:pt-16"><div className="mx-auto max-w-5xl">
      <p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-300">Suno Downloader Online</p>
      <h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight sm:text-6xl">Tải nhạc Suno miễn phí <span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">MP3, WAV, M4A & Video</span></h1>
      <p className="mt-5 max-w-3xl text-base leading-7 text-white/60 sm:text-lg">Dán link bài hát Suno để tải audio, video, ảnh bìa và lyrics về điện thoại hoặc máy tính. Không cần cài ứng dụng, không cần đăng nhập.</p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-white/55">{['MP3','WAV','M4A','Video','Ảnh bìa','Lyrics'].map(item=><span key={item} className="rounded-full border border-white/10 bg-white/[.05] px-3 py-1.5">✓ {item}</span>)}</div>
    </div></section>
    <style>{`main > section > div:first-child, main > section > h1 { display:none !important; }`}</style>
    <V4SafePage />
    <V5DownloadEnhancer />
    <V5PresetGalleryEnhancer />
    <section className="bg-[#080812] px-5 pb-20 text-white sm:px-8"><div className="mx-auto max-w-5xl border-t border-white/10 pt-12">
      <div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.22em] text-violet-300">Tải nhạc Suno online</p><h2 className="mt-3 text-3xl font-bold sm:text-4xl">Một link Suno, tải đủ file bạn cần</h2><p className="mt-4 leading-7 text-white/65">Suno Grab ưu tiên chức năng tải xuống trước: audio, video, cover, lyrics và metadata. Visualizer có 12 preset video mẫu để tạo nhanh nội dung TikTok, Reels, Shorts hoặc YouTube.</p></div>
      <div className="mt-10 grid gap-4 md:grid-cols-4">{[
        ['Tải Suno MP3/WAV','Chuyển audio sang MP3 hoặc WAV ngay trên trình duyệt.'],['Tải video Suno','Lưu video gốc nếu bài hát có video.'],['Cover + Lyrics','Lưu ảnh bìa và lời bài hát khi dữ liệu có sẵn.'],['12 preset Visualizer','Album, Social, Lyrics và Visualizer cho nhiều tỉ lệ video.'],
      ].map(([title,text])=><article key={title} className="rounded-2xl border border-white/10 bg-white/[.045] p-5"><h3 className="font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/55">{text}</p></article>)}</div>
      <div className="mt-12 grid gap-8 md:grid-cols-[.9fr_1.1fr]"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Hướng dẫn</p><h2 className="mt-2 text-2xl font-bold">Cách tải nhạc Suno</h2><ol className="mt-5 space-y-4 text-sm leading-6 text-white/65"><li><b className="text-white">1.</b> Mở bài hát trên Suno và sao chép liên kết chia sẻ.</li><li><b className="text-white">2.</b> Dán link vào ô ở đầu trang. Công cụ tự nhận diện bài hát.</li><li><b className="text-white">3.</b> Chọn MP3, WAV, M4A, video, cover, lyrics hoặc metadata.</li><li><b className="text-white">4.</b> Nếu muốn đăng mạng xã hội, chọn một preset Visualizer rồi preview 10 giây.</li></ol></div><div><p className="text-xs font-bold uppercase tracking-[.2em] text-fuchsia-300">FAQ</p><h2 className="mt-2 text-2xl font-bold">Câu hỏi thường gặp về tải nhạc Suno</h2><div className="mt-5 space-y-3">{faq.map(item=><details key={item.question} className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><summary className="cursor-pointer font-semibold">{item.question}</summary><p className="mt-3 text-sm leading-6 text-white/60">{item.answer}</p></details>)}</div></div></div>
      <p className="mt-12 text-xs leading-5 text-white/35">Hãy chỉ tải hoặc sử dụng nội dung mà bạn có quyền lưu và sử dụng.</p>
    </div></section>
  </>;
}
