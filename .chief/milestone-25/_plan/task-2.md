# Task 2: Fix Buyer Profile Guard and Readability

## Objective

Fix existing profile page defects without adding any new profile feature.

## Required Changes

- Ensure `app/[locale]/(buyer)/profile/page.tsx` requires an authenticated user before rendering the client profile component.
- Update `ProfilePage` shortcut buttons, helper text, profile metadata, and seller status secondary text to high-contrast buyer colors consistent with milestone 24.
- Keep existing profile form behavior, phone OTP behavior, seller status links, and address summary behavior unchanged.

## Constraints

- No new profile fields.
- No API changes.
- No new navigation destinations.
- Do not change seller dashboard styling.

## Verification

- Run focused profile tests if present.
- Confirm the diff is limited to guard/readability/presentation.
