import type { MetadataRoute } from 'next';
import { getPublicMusicDirectory } from '@/app/lib/music-directory';

export const revalidate = 900;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://picai.online';
  const directory = await getPublicMusicDirectory();

  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/music`,
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: `${base}/tai-suno-mp3`,
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    {
      url: `${base}/tai-suno-wav`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/tai-video-suno`,
      changeFrequency: 'monthly',
      priority: 0.85,
    },
  ];

  const creatorUrls: MetadataRoute.Sitemap = directory.creators.map(
    (creator) => ({
      url: `${base}/music/@${encodeURIComponent(creator.handle)}`,
      lastModified: creator.updatedAt
        ? new Date(creator.updatedAt)
        : creator.syncedAt
          ? new Date(creator.syncedAt)
          : undefined,
      changeFrequency: 'daily',
      priority: 0.8,
    }),
  );

  const songUrls: MetadataRoute.Sitemap = directory.creators
    .flatMap((creator) =>
      creator.songs.map((song) => ({
        url: `${base}/music/@${encodeURIComponent(creator.handle)}/${song.id}`,
        lastModified: song.createdAt ? new Date(song.createdAt) : undefined,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      })),
    )
    .slice(0, 49_000);

  return [...staticUrls, ...creatorUrls, ...songUrls];
}
