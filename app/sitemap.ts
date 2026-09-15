import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://suno.aiautotool.com';
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/tai-suno-mp3`, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/tai-suno-wav`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/tai-video-suno`, changeFrequency: 'monthly', priority: 0.85 },
  ];
}
