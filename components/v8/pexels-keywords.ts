const VIDEO_COVER_SUBJECTS = [
  'lonely silhouette at sunset',
  'couple silhouette under street lights',
  'moody portrait with backlight',
  'cinematic profile portrait',
  'person walking on empty road',
  'night city skyline',
  'rainy neon street',
  'futuristic neon tunnel',
  'ocean horizon at dusk',
  'dramatic mountain landscape',
  'misty forest path',
  'moonlit clouds',
  'desert dunes at sunset',
  'starry night sky',
  'abstract smoke and light',
  'abstract liquid gradient',
  'glowing particles on dark background',
  'prism light reflections',
  'flower field at sunset',
  'vintage car on night road',
  'empty train station at night',
  'cozy room with rainy window',
  'concert stage lights',
  'minimal architecture and shadows',
  'surreal dream landscape',
] as const;

const VIDEO_COVER_DIRECTIONS = [
  'cinematic music cover',
  'premium album cover background',
  'HD editorial photography',
  'fine art photography',
  'moody film still',
  'dreamy atmospheric art',
  'dark aesthetic cover',
  'soft volumetric lighting',
  'dramatic rim lighting',
  'minimal negative space',
  'surreal visual art',
  'ethereal fantasy mood',
  'neon cyberpunk aesthetic',
  'retro film grain',
  'luxury editorial style',
  'high contrast photography',
  'blue hour cinematic',
  'golden hour cinematic',
  'monochrome fine art',
  'color grade poster background',
] as const;

/**
 * 25 cover-friendly subjects × 20 art directions = exactly 500 phrases.
 *
 * These queries are intentionally written for music/video covers:
 * - strong single subject or readable scene
 * - cinematic/editorial/art direction
 * - dark or negative-space friendly composition for title/lyrics overlays
 * - search terms that tend to return high-resolution photography on Pexels
 *
 * English is intentional because Pexels has broader and more consistent
 * search coverage for these visual terms.
 */
export const IMAGE_SEARCH_KEYWORDS = VIDEO_COVER_SUBJECTS.flatMap((subject) =>
  VIDEO_COVER_DIRECTIONS.map((direction) => `${direction} ${subject}`),
);

export const IMAGE_SEARCH_KEYWORD_COUNT = IMAGE_SEARCH_KEYWORDS.length;

export function randomImageSearchKeyword(exclude?: string) {
  if (!IMAGE_SEARCH_KEYWORDS.length) {
    return 'cinematic music cover moody silhouette HD';
  }
  if (IMAGE_SEARCH_KEYWORDS.length === 1) return IMAGE_SEARCH_KEYWORDS[0];

  let next =
    IMAGE_SEARCH_KEYWORDS[
      Math.floor(Math.random() * IMAGE_SEARCH_KEYWORDS.length)
    ];

  // Avoid showing the exact same cover concept twice in a row.
  for (let attempt = 0; attempt < 10 && next === exclude; attempt += 1) {
    next =
      IMAGE_SEARCH_KEYWORDS[
        Math.floor(Math.random() * IMAGE_SEARCH_KEYWORDS.length)
      ];
  }

  return next === exclude
    ? IMAGE_SEARCH_KEYWORDS.find((keyword) => keyword !== exclude) || next
    : next;
}
