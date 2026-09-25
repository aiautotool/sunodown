export type AppPlan = 'free' | 'pro';

export type Entitlement =
  | 'premium_presets'
  | 'export_4k'
  | 'fast_render'
  | 'batch_render'
  | 'advanced_mastering'
  | 'ai_styling';

const MATRIX: Record<AppPlan, Record<Entitlement, boolean>> = {
  free: {
    premium_presets: false,
    export_4k: false,
    fast_render: false,
    batch_render: false,
    advanced_mastering: true,
    ai_styling: false,
  },
  pro: {
    premium_presets: true,
    export_4k: true,
    fast_render: true,
    batch_render: true,
    advanced_mastering: true,
    ai_styling: true,
  },
};

export function canUse(plan: AppPlan, entitlement: Entitlement) {
  return MATRIX[plan][entitlement];
}

export function planCapabilities(plan: AppPlan) {
  return { ...MATRIX[plan] };
}

export const DEFAULT_PLAN: AppPlan = 'free';
