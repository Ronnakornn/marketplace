# Contract: UI Verification

## Required Automated Checks

Run:

```bash
bunx tsc --noEmit
bun run test
```

Frontend tests must cover:

- seller product list states
- seller product editor readiness checklist
- variant matrix duplicate errors
- media manager primary/reorder behavior
- buyer variant selection and quantity limit
- admin moderation reason-required actions

## Required Browser Checks

Use Browser/Playwright screenshots for:

- seller product editor desktop
- seller product editor mobile
- seller variant matrix desktop
- buyer product detail desktop
- buyer product detail mobile
- admin moderation queue desktop
- admin moderation detail desktop

Browser verification must check:

- no incoherent overlap
- sticky CTA visible and usable
- forms readable on mobile
- disabled states visually clear
- mutation pending states visible

## Design Rules

- Use existing Tailwind and shadcn/ui styling patterns.
- Use icons for clear commands where available.
- Use tabs/section nav for editor sections.
- Avoid nested cards in operational screens.
- Do not introduce a major palette or brand redesign.
