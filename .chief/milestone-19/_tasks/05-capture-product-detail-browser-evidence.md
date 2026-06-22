# Task 05: Capture Product Detail Browser Evidence

## Objective

Collect browser evidence proving the buyer product detail route renders correctly after the route/SEO fix.

## Scope

- Start frontend and backend dev services as needed.
- Open a known active product detail route through the frontend origin.
- Capture desktop screenshot.
- Capture mobile screenshot.
- Capture logged-in buyer screenshot showing buyer-visible product state.
- Save screenshots and notes under `.chief/milestone-19/_report/`.
- Stop dev services started by the task.

## Constraints

- Use same-origin frontend routes for browser verification.
- Do not use client-side fake data or route bypasses.
- If login or seed data blocks verification, document exact credentials attempted, URL, API response, route response, and blocker.

## Verification

- `.chief/milestone-19/_report/` contains screenshots or a precise blocker report.
- Browser evidence uses the same product id/slug that appeared in API diagnosis.
