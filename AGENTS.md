# AGENTS.md

Every section is normative. A change that breaks a rule is a defect.

## Architecture

- `src/api` is the only place that talks to a server. No other directory calls `fetch`.
  `resources/<name>.ts` exposes one typed function per operation id.
- `src/api` imports only `src/lib`. `src/lib` imports only `src/api/types.ts`, and holds no React and
  no I/O. Outside `src/features`, only `App.tsx`, `app-router.tsx` and `app-shell.tsx` import from
  `src/features`.
- `src/components/ui` holds the vendored shadcn primitives. `src/hooks` holds hooks that more than one
  screen shares.
- A new or changed operation in `src/api` also updates `mock/`, so that `pnpm dev:all` serves it.
- **A component body holds no business logic.** Derivation, sequencing and error mapping live in
  `src/api` or in a hook beside the screen, for example `use-credential-rotate.ts`. A component reads
  state and renders it.
- **`ApiError` is the only error type crossing the api boundary.** A resource function either resolves
  its typed result or rejects with `ApiError`. It never returns an error shape as data.
- **`src/api/types.ts` follows the contract, never the screen.** A field a screen wants but the
  contract does not carry is a contract question, not a type edit.
- **No test knowledge in application code.** No branch on `NODE_ENV`, `import.meta.env.MODE`, a
  `*TEST*` variable or an `isTest` flag; no fake reachable from a non-test module; no export that
  exists only for an assertion.
- **Guard a destructive or irreversible action before the call.** Never rely on a daemon refusal. Name
  the consequence in the words of the human and offer the safer path. Offer only paths that the
  contract can serve. If step one commits and step two fails, report both facts and attempt no partial
  rollback.
- **One responsibility per file.** A file exports one screen, one resource, or one helper group.

## Design

- **`src/components/ui` holds the vendored shadcn primitives** (`base-vega` style). Add one with
  `pnpm dlx shadcn@latest add <name>`. Never hand-edit, hand-write or copy a primitive.
- A router `Link` that acts as a control renders through `Button render={<Link />}`. A text link in
  prose stays a plain `Link`.
- **Compose the shared components before you write a new one.** A collection is a `DataList` of
  `DataListItem` rows (an `Item` list), never a table, with one rendering on both widths. A searchable
  field is `SearchChoiceField`. Show and hide go through `Reveal` or `RevealPanel`. A record name
  inside prose goes through `RecordName`.
- **Use the stock appearance.** Use the `variant` and `size` props that a primitive already has.
  `className` on a primitive carries layout only: width, flex or grid placement, margin and gap. It
  does not override color, border, radius, typography, height or padding. Color comes only from the
  theme tokens in `src/index.css`. If a usability or accessibility defect remains after composition
  and layout changes, make the smallest adjustment outside `src/components/ui` and name the defect in
  the commit message.
- Every screen offers the same information and actions at 390×844 and 1280×800, with no horizontal
  scroll. Hover never holds information alone.
- Before approval, run `pnpm dev:all` and check each changed screen at both widths.

## Resource screens

- A resource has three screens: the list at `/<section>`, the form at `/<section>/new` and the detail
  at `/<section>/:name`. Copy `src/features/credentials`, the reference implementation.
- A filter reads its options from the server. No constant in the client repeats a set that the server
  answers.
- The client validates what the server validates, including the reserved names, before it sends.
- A destructive action never sits on a list row, and it opens an `AlertDialog`. An edit opens a
  `Sheet`.
- An action that a kind cannot serve stays visible and disabled through `DisabledAction`.
- A row of a revisioned record shows its effective revision as `(v<revision>)` next to its name or
  identity, with no second revision field.

## Tests

- Put each test beside its unit under `src/`. Query by role, label or text, never by class, test id or
  snapshot. Fake the `src/api` resource, never `fetch`.

## Commands

- Run `pnpm verify` in the `apps` directory before a commit. It runs typecheck, test, lint with no
  warnings, and format:check.
