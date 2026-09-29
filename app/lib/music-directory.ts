import { env } from 'cloudflare:workers';

export type DirectorySong = {
  id: string;
  title: string;
  creator?: string | null;
  handle: string;
  picture?: string | null;
  duration?: number | null;
  tags?: string | null;
  createdAt?: string | null;
  discoveredAt?: string | null;
  isPublic: true;
  playCount?: number;
  score?: number;
  trendingScore?: number;
};

export type DirectoryCreator = {
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  syncedAt?: string | null;
  songs: DirectorySong[];
  songCount: number;
  publisherCount: number;
  updatedAt: number;
};

export type PublicMusicDirectorySnapshot = {
  creators: DirectoryCreator[];
  latestSongs: DirectorySong[];
  trendingSongs: DirectorySong[];
  topSongs: DirectorySong[];
  featuredSong: DirectorySong | null;
  creatorCount: number;
  songCount: number;
  updatedAt: number;
};

type DurableBinding = {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
};

const emptyDirectory = (): PublicMusicDirectorySnapshot => ({
  creators: [],
  latestSongs: [],
  trendingSongs: [],
  topSongs: [],
  featuredSong: null,
  creatorCount: 0,
  songCount: 0,
  updatedAt: 0,
});

export async function getPublicMusicDirectory(): Promise<PublicMusicDirectorySnapshot> {
  const namespace = (env as unknown as { MUSIC_DIRECTORY?: DurableBinding })
    .MUSIC_DIRECTORY;

  if (!namespace) return emptyDirectory();

  try {
    const stub = namespace.get(namespace.idFromName('global'));
    const response = await stub.fetch('https://music.internal/directory');
    if (!response.ok) return emptyDirectory();
    const value = (await response.json()) as Partial<PublicMusicDirectorySnapshot>;
    return {
      ...emptyDirectory(),
      ...value,
      creators: Array.isArray(value.creators) ? value.creators : [],
      latestSongs: Array.isArray(value.latestSongs) ? value.latestSongs : [],
      trendingSongs: Array.isArray(value.trendingSongs) ? value.trendingSongs : [],
      topSongs: Array.isArray(value.topSongs) ? value.topSongs : [],
      featuredSong: value.featuredSong || null,
    };
  } catch {
    return emptyDirectory();
  }
}
