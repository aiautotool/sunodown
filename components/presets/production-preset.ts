import type { AdvancedMasterSettings, MasterProfileId, Spatial5DMode } from '@/app/lib/audio-processing';
import type { SmartRenderQualityMode } from '@/components/v10/smart-render-quality';
import type { VideoAspect } from '@/components/v4/types';

export type ProductionMasterProfile = 'original' | MasterProfileId;
export type ProductionMasteringConfig = {
  profile: ProductionMasterProfile;
  advanced?: AdvancedMasterSettings;
  spatial?: { enabled: boolean; mode: Spatial5DMode; amount: number };
};
export type ProductionExportConfig = {
  aspect: VideoAspect;
  quality: SmartRenderQualityMode;
   durationMode: 'full' | '30s' | 'custom';
 };
export type ProductionPresetConfig = {
  mastering: ProductionMasteringConfig;
  export: ProductionExportConfig;
};

export const DEFAULT_PRODUCTION_MASTERING: ProductionMasteringConfig = {
  profile: 'original',
  spatial: { enabled: false, mode: 'immersive', amount: 65 },
};
export const DEFAULT_PRODUCTION_EXPORT: ProductionExportConfig = {
  aspect: '9:16',
  quality: 'auto',
   durationMode: 'full',
 };

const MASTERING = new Set<ProductionMasterProfile>(['original','clean','tiktok-loud','punchy','max-loud']);
const QUALITY = new Set<SmartRenderQualityMode>(['auto','data-saver','balanced','high']);
 const DURATION = new Set<ProductionExportConfig['durationMode']>(['full','30s','custom']);
const ASPECT = new Set<VideoAspect>(['16:9','9:16','1:1','4:5','4:3']);

export function normalizeProductionPreset(
  value: Partial<ProductionPresetConfig> | null | undefined,
  fallbackAspect: VideoAspect,
): ProductionPresetConfig {
  const mastering = value?.mastering || DEFAULT_PRODUCTION_MASTERING;
  const profile = MASTERING.has(mastering.profile as ProductionMasterProfile)
    ? mastering.profile as ProductionMasterProfile
    : 'original';
  const spatial = mastering.spatial || DEFAULT_PRODUCTION_MASTERING.spatial!;
  const exp = value?.export || DEFAULT_PRODUCTION_EXPORT;
  return {
    mastering: {
      profile,
      advanced: mastering.advanced ? structuredClone(mastering.advanced) : undefined,
      spatial: {
        enabled: Boolean(spatial.enabled),
        mode: ['wide','immersive','orbit'].includes(spatial.mode) ? spatial.mode : 'immersive',
        amount: Math.max(20, Math.min(100, Number(spatial.amount) || 65)),
      },
    },
    export: {
      aspect: ASPECT.has(exp.aspect as VideoAspect) ? exp.aspect as VideoAspect : fallbackAspect,
      quality: QUALITY.has(exp.quality as SmartRenderQualityMode) ? exp.quality as SmartRenderQualityMode : 'auto',
      durationMode: DURATION.has(exp.durationMode as ProductionExportConfig['durationMode']) ? exp.durationMode as ProductionExportConfig['durationMode'] : 'full',
    },
  };
}

export function productionFingerprint(config: ProductionPresetConfig) {
  const value = JSON.stringify(config);
  let hash = 2166136261;
  for (let i=0;i<value.length;i+=1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash,16777619); }
  return (hash>>>0).toString(36).padStart(7,'0');
}
export function masteringLabel(profile: ProductionMasterProfile) {
  return profile==='original'?'Original':profile==='tiktok-loud'?'TikTok':profile==='max-loud'?'Max Loud':profile==='punchy'?'Punchy':'Clean';
}
