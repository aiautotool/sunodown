export const BACKGROUND_PRESETS={
  'dark-film':['#090b12','#171425','#05070b'],
  'neon-blur':['#10152d','#6d28d9','#0ea5e9'],
  'concert-light':['#120c1f','#7c2d12','#4c1d95'],
  'soft-light':['#1f2937','#475569','#cbd5e1'],
  'romantic-glow':['#2a1023','#9d174d','#7c3aed'],
  'dreamy-blue':['#0c1b33','#1d4ed8','#7c3aed'],
  'bokeh-night':['#070b17','#172554','#581c87'],
} as const;

export type BackgroundPresetId=keyof typeof BACKGROUND_PRESETS;

export function backgroundPresetColors(id:string):readonly [string,string,string]{
  return BACKGROUND_PRESETS[id as BackgroundPresetId]||BACKGROUND_PRESETS['dark-film'];
}
