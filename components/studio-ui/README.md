# SunoDown Studio UI System

Stable product-facing component layer for Creator Studio. Feature code should compose these components instead of inventing local UI patterns.

## Foundation
Tokens/theme: `tokens.ts` + global `--studio-*` CSS variables. Client rebranding changes tokens, not every feature.

## Components
Actions: StudioButton, StudioIconButton, StudioToolbar.
Containers: StudioPanel, StudioCard, StudioSheet, StudioModal, StudioStack, StudioDivider.
Navigation: StudioTabs, StudioSegmented, StudioAccordion.
Forms: StudioField, StudioInput, StudioTextarea, StudioSelect, StudioSlider, StudioToggle, StudioControlRow.
Feedback: StudioBadge, StudioStatus, StudioProgress, StudioToast, StudioSkeleton, StudioEmpty.

## Contract
1. New product UI imports from `@/components/studio-ui`.
2. Business, renderer and DSP logic never belongs in primitives.
3. Variants are props/data attributes; do not fork components just to change colors/radius.
4. All user-facing text must be supplied by the feature/i18n layer; primitives do not own product copy except accessibility defaults.
5. Mobile behavior is part of the primitive contract.
6. Breaking prop changes require a Studio UI version bump.

## Client update
Override `--studio-bg`, `--studio-surface`, `--studio-surface-2`, `--studio-border`, `--studio-text`, `--studio-muted`, `--studio-accent`, status colors, `--studio-radius` and `--studio-control-h`. Feature markup remains unchanged.
