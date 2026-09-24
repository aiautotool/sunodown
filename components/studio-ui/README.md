# SunoDown Studio UI System

Use `components/studio-ui` for product UI. Do not create one-off buttons, panels, toggles, accordions or sheets in feature code.

## Rules
- Theme values live in `tokens.ts`; client branding changes start there or in the CSS variables.
- Components expose variants through props/data attributes. Feature components compose them; they do not duplicate their CSS.
- Keep business/DSP logic outside the UI primitives.
- New controls should prefer: `StudioButton`, `StudioPanel`, `StudioBadge`, `StudioToggle`, `StudioControlRow`, `StudioAccordion`, `StudioSheet`.
- Existing shadcn/base-ui components remain available for low-level accessibility behavior; Studio UI is the stable product-facing layer above them.

## Client update path
Change the `--studio-*` variables to rebrand radius, surfaces, borders, text and accent globally without editing each feature. Component APIs stay stable.
