const IMAGE_SCENES = [
  'sunset beach',
  'rainy window',
  'neon city',
  'misty forest',
  'mountain lake',
  'empty road',
  'night skyline',
  'flower field',
  'ocean waves',
  'moonlit clouds',
  'cozy cafe',
  'old train station',
  'desert dunes',
  'snowy mountains',
  'city street rain',
  'romantic balcony',
  'dark hallway',
  'vintage room',
  'dreamy clouds',
  'river reflections',
  'lonely bench',
  'forest cabin',
  'concert lights',
  'silhouette couple',
  'abstract light',
] as const;

const IMAGE_STYLES = [
  'cinematic',
  'moody',
  'dreamy',
  'minimal',
  'dark aesthetic',
  'soft light',
  'golden hour',
  'blue hour',
  'film grain',
  'vintage',
  'romantic',
  'melancholic',
  'atmospheric',
  'surreal',
  'ethereal',
  'dramatic',
  'peaceful',
  'nostalgic',
  'editorial',
  'high contrast',
] as const;

/**
 * 25 scene concepts × 20 visual styles = exactly 500 image-search phrases.
 * English is intentional because Pexels search coverage is stronger and more
 * consistent across international stock libraries.
 */
export const IMAGE_SEARCH_KEYWORDS = IMAGE_SCENES.flatMap((scene) =>
  IMAGE_STYLES.map((style) => `${style} ${scene}`),
);

export const IMAGE_SEARCH_KEYWORD_COUNT = IMAGE_SEARCH_KEYWORDS.length;

export function randomImageSearchKeyword(exclude?: string) {
  if (!IMAGE_SEARCH_KEYWORDS.length) return 'cinematic sunset landscape';
  if (IMAGE_SEARCH_KEYWORDS.length === 1) return IMAGE_SEARCH_KEYWORDS[0];

  let next = IMAGE_SEARCH_KEYWORDS[
    Math.floor(Math.random() * IMAGE_SEARCH_KEYWORDS.length)
  ];

  // Avoid showing the exact same theme twice in a row.
  for (let attempt = 0; attempt < 8 && next === exclude; attempt += 1) {
    next = IMAGE_SEARCH_KEYWORDS[
      Math.floor(Math.random() * IMAGE_SEARCH_KEYWORDS.length)
    ];
  }

  return next === exclude
    ? IMAGE_SEARCH_KEYWORDS.find((keyword) => keyword !== exclude) || next
    : next;
}
