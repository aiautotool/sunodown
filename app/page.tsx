import V4SafePage from '@/components/v4/page-safe';

const faq = [
  {
    question: 'Cách tải nhạc Suno về điện thoại?',
    answer: 'Sao chép liên kết bài hát Suno, dán vào ô trên trang, chờ hệ thống nhận diện bài hát rồi chọn định dạng hoặc video bạn muốn lưu.',
  },
  {
    question: 'Có thể tải Suno MP3, WAV và M4A không?',
    answer: 'Có. Suno Grab hỗ trợ tải âm thanh và chuyển đổi sang các định dạng phổ biến như MP3, WAV, M4A tùy khả năng của trình duyệt và nguồn bài hát.',
  },
  {
    question: 'Có thể tải video Suno không?',
    answer: 'Có. Bạn có thể tải video gốc nếu bài hát có video hoặc tạo video visualizer với nhiều tỉ lệ và template khác nhau.',
  },
  {
    question: 'Tải nhạc Suno có cần cài ứng dụng không?',
    answer: 'Không. Công cụ chạy trực tiếp trên trình duyệt và phù hợp cho cả điện thoại lẫn máy tính.',
  },
];

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name: 'Suno Grab',
      url: 'https://suno.aiautotool.com/',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web',
      inLanguage: 'vi',
      description: 'Công cụ tải nhạc Suno và tạo video visualizer trực tiếp trên trình duyệt.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'VND' },
    },
    {
      '@type': 'FAQPage',
      mainEntity: faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ],
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <V4SafePage />
      <section className="bg-[#080812] px-5 pb-20 text-white sm:px-8">
        <div className="mx-auto max-w-5xl border-t border-white/10 pt-12">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[.22em] text-violet-300">Suno Downloader</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Tải nhạc Suno nhanh trên điện thoại và máy tính</h2>
            <p className="mt-4 leading-7 text-white/65">
              Suno Grab giúp bạn tải nhạc Suno từ liên kết bài hát mà không cần cài thêm ứng dụng. Dán link Suno, chọn định dạng phù hợp rồi lưu file về thiết bị. Ngoài âm thanh, công cụ còn hỗ trợ video gốc và tạo video visualizer để đăng TikTok, Reels, Shorts hoặc YouTube.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-white/[.045] p-5">
              <h3 className="font-bold">Tải Suno MP3, WAV, M4A</h3>
              <p className="mt-2 text-sm leading-6 text-white/55">Chọn định dạng âm thanh phù hợp để nghe, lưu trữ hoặc tiếp tục chỉnh sửa trên thiết bị.</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/[.045] p-5">
              <h3 className="font-bold">Tải video Suno</h3>
              <p className="mt-2 text-sm leading-6 text-white/55">Lưu video gốc khi có sẵn hoặc render visualizer theo tỉ lệ 9:16, 16:9, 1:1 và nhiều preset mạng xã hội.</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/[.045] p-5">
              <h3 className="font-bold">Không cần cài app</h3>
              <p className="mt-2 text-sm leading-6 text-white/55">Hoạt động trực tiếp trên trình duyệt, tối ưu cho thao tác dán link, preview và lưu video trên điện thoại.</p>
            </article>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-[.9fr_1.1fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Hướng dẫn</p>
              <h2 className="mt-2 text-2xl font-bold">Cách tải nhạc Suno</h2>
              <ol className="mt-5 space-y-4 text-sm leading-6 text-white/65">
                <li><b className="text-white">1.</b> Mở bài hát trên Suno và sao chép liên kết chia sẻ.</li>
                <li><b className="text-white">2.</b> Dán link vào ô ở đầu trang. Công cụ sẽ tự nhận diện bài hát.</li>
                <li><b className="text-white">3.</b> Chọn MP3, WAV, M4A, video gốc hoặc tạo visualizer.</li>
                <li><b className="text-white">4.</b> Xem trước kết quả rồi tải xuống hoặc lưu/chia sẻ trên điện thoại.</li>
              </ol>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-fuchsia-300">FAQ</p>
              <h2 className="mt-2 text-2xl font-bold">Câu hỏi thường gặp về tải nhạc Suno</h2>
              <div className="mt-5 space-y-3">
                {faq.map((item) => (
                  <details key={item.question} className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
                    <summary className="cursor-pointer font-semibold">{item.question}</summary>
                    <p className="mt-3 text-sm leading-6 text-white/60">{item.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-12 text-xs leading-5 text-white/35">Hãy chỉ tải hoặc sử dụng nội dung mà bạn có quyền lưu và sử dụng.</p>
        </div>
      </section>
    </>
  );
}
