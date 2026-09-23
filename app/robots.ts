import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: 'https://suno.aiautotool.com/sitemap.xml',
    host: 'https://suno.aiautotool.com',
  };
}
