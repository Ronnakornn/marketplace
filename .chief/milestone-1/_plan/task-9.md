# task-9: Add reusable default data table component for project tables

## Goal

Create a reusable default data table component for project-wide table screens using TanStack Table and the existing shadcn `<Table />` primitives.

## Scope

- Add `app/components/ui/data-table.tsx`.
- Follow the shadcn Data Table pattern:
  - caller-owned `columns`
  - caller-owned `data`
  - `useReactTable`
  - `flexRender`
  - existing `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, and `TableCell`
- Support common behavior needed by `/seller/products`:
  - sorting
  - pagination
  - optional global/filter toolbar slot
  - optional column visibility controls if it stays small and generic
  - loading and empty states
- Keep the component domain-agnostic.

## Out of Scope

- Do not import seller/product hooks or seller product types.
- Do not refactor unrelated table screens in this task.
- Do not add a heavy table abstraction that owns API fetching.

## Verification

- Add a focused component test for rendering rows, empty state, and pagination/sorting behavior where practical.
- Run the focused test.
- Run `bunx tsc --noEmit`.
