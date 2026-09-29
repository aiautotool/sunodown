export type StudioFontOption = {
  id: string;
  label: string;
  family: string;
  group: 'Core' | 'CoolText';
  hint: string;
};

export const STUDIO_TITLE_FONTS: StudioFontOption[] = [
  {
    id: 'modern',
    label: 'Modern',
    family: 'system-ui, sans-serif',
    group: 'Core',
    hint: 'Sạch, trung tính',
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    family: 'Georgia, serif',
    group: 'Core',
    hint: 'Serif điện ảnh',
  },
  {
    id: 'rounded',
    label: 'Rounded',
    family: "'Trebuchet MS', sans-serif",
    group: 'Core',
    hint: 'Mềm và dễ đọc',
  },
  {
    id: 'mono',
    label: 'Mono',
    family: "'Courier New', monospace",
    group: 'Core',
    hint: 'Kỹ thuật, tối giản',
  },
  {
    id: 'impact',
    label: 'Impact',
    family: 'Impact, sans-serif',
    group: 'Core',
    hint: 'Đậm, social',
  },
  {
    id: 'bebas-neue',
    label: 'Bebas Neue',
    family: "'Bebas Neue', Impact, sans-serif",
    group: 'CoolText',
    hint: 'Display · All Caps',
  },
  {
    id: 'orbitron',
    label: 'Orbitron',
    family: "'Orbitron', 'Trebuchet MS', sans-serif",
    group: 'CoolText',
    hint: 'Futuristic · Techno',
  },
  {
    id: 'dancing-script',
    label: 'Dancing Script',
    family: "'Dancing Script', cursive",
    group: 'CoolText',
    hint: 'Handwriting · Romantic',
  },
  {
    id: 'tangerine',
    label: 'Tangerine',
    family: "'Tangerine', cursive",
    group: 'CoolText',
    hint: 'Elegant · Calligraphy',
  },
  {
    id: 'special-elite',
    label: 'Special Elite',
    family: "'Special Elite', 'Courier New', monospace",
    group: 'CoolText',
    hint: 'Retro · Typewriter',
  },
];

export async function ensureStudioFontsReady(
  families: Array<string | null | undefined>,
) {
  if (typeof document === 'undefined' || !document.fonts) return;

  const unique = [...new Set(families.filter((value): value is string => Boolean(value)))];
  await Promise.all(
    unique.map(async (family) => {
      try {
        await Promise.race([
          Promise.all([
            document.fonts.load(`400 48px ${family}`),
            document.fonts.load(`700 48px ${family}`),
          ]),
          new Promise<void>((resolve) => window.setTimeout(resolve, 2500)),
        ]);
      } catch {
        // Canvas keeps the declared fallback family if a remote font is unavailable.
      }
    }),
  );
}
