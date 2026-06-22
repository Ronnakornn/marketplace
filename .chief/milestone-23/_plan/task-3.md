# Task 3: Message Dictionary Completion

## Objective

Complete and normalize message dictionaries for scoped buyer-facing and public shopping surfaces.

## Affected Areas

- `messages/en.json`
- `messages/th.json`
- optional report notes under `.chief/milestone-23/_report/task-3/`

## Requirements

- Add all keys needed by scoped buyer/public shopping surfaces.
- Keep key structure matched between English and Thai.
- Ensure placeholder names match exactly across locales.
- Normalize Thai values used by scoped buyer/public shopping namespaces to readable UTF-8 Thai.
- Preserve existing public API-provided data as dynamic content; do not move product titles, shop names, order numbers, addresses, coupon codes, or user-generated content into messages.
- Keep English values concise and consistent with existing product tone.

## Suggested Namespaces

- `common`
- `home`
- `product`
- `cart`
- `checkout`
- `order`
- `chat`
- `buyer`
- `notification`
- `affiliate`
- `state`

## Constraints

- Do not change locale configuration.
- Do not alter business behavior.
- Keep JSON valid and stable.

## Verification

- Run the i18n audit from task-2.
- Run TypeScript or focused tests if message typing changes.

## Done When

- Scoped message gaps are closed.
- Thai scoped messages are readable.
- `_todo.md` marks task-3 complete.

