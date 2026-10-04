# AGENTS.md

The binding contract for every agent that writes code in this repository. The `## Architecture`
section is normative: a change that breaks a rule in it is a defect, not a style preference.

## Toolchain

- One package at the repository root. Node 24.15.0 (`.nvmrc`), pnpm, ESM only.
- TypeScript strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`. Bundler resolution, so a
  relative import carries no file extension. `@/` resolves to `src/`.
- Tailwind CSS v4 through `@tailwindcss/vite`. The theme tokens live in `src/index.css`.
- React 19 on Vite. Tests run on vitest with jsdom and `@testing-library/react`.

## Architecture

Four layers. Each one may import the layer below it and never the layer above it.

1. `src/api/**` — the contract layer, and **the only place that talks to a server**. No other
   directory calls `fetch`, and no component constructs a request. `client.ts` is the single
   transport seam; `resources/<name>.ts` exposes one typed function per operation id; `types.ts`
   follows the daemon contract; `errors.ts` owns `ApiError` and its code union.
2. `src/features/<area>/<screen>/**` — one directory per screen. It owns that screen's state and its
   calls into `src/api`. A screen's private parts live in its own `components/` subdirectory.
3. `src/components/**` — application-wide composition. It knows the router. It does not know an
   operation id.
4. `src/lib/**` — pure helpers with no React and no I/O.

Two shelves sit beside the four layers and belong to no screen:

- `src/components/ui/**` — the vendored shadcn primitives, owned by `components.json` and rewritten by
  the shadcn CLI. Compose them; never hand-edit one to suit a screen.
- `src/hooks/**` — React hooks that more than one screen shares. A hook that one screen needs lives
  beside that screen instead.

Rules that hold across the layers:

- **A component body holds no business logic.** Derivation, sequencing and error mapping live in
  `src/api` or in a hook beside the screen. A component reads state and renders it.
- **`ApiError` is the only error type crossing the api boundary.** A resource function either resolves
  its typed result or rejects with `ApiError`. It never returns an error shape as data.
- **`src/api/types.ts` follows the contract, never the screen.** A field a screen wants but the
  contract does not carry is a contract question, not a type edit.
- **No test knowledge in application code.** No branch on `NODE_ENV`, `import.meta.env.MODE`, a
  `*TEST*` variable or an `isTest` flag; no fake reachable from a non-test module; no export that
  exists only for an assertion. A test fakes at the `src/api` seam instead.
- **A destructive or irreversible action carries a pre-flight guard.** Never rely on the daemon to
  refuse it. A refusal the daemon raises today can be dropped tomorrow, and the screen that depended
  on it then destroys something silently. Decide before the call, not after the rejection.

  The guard is derivation and sequencing, so it lives in a hook beside the screen or in `src/api`,
  never in a component body. It names the consequence in the human's own words, offers the safer path
  beside the destructive one, and offers only paths the contract can actually serve — a control that
  the daemon is certain to refuse must not be rendered at all. When the safer path is unavailable, say
  why rather than rendering a disabled control with no explanation.

  A multi-step guard reports what actually happened. If step one commits and step two fails, report
  both facts. Attempt no rollback that is not a true restoration: undoing half of a sequence usually
  leaves the human worse off than the truth.

- **One responsibility per file.** A file exports one screen, one resource, or one helper group.

## Design

The `## Design` section is normative. A change that breaks a rule in it is a defect.

- **shadcn is the only source of primitives.** `components.json` selects the `base-vega` style, so
  every primitive is built on `@base-ui/react`. No module imports `radix-ui` or a `@radix-ui/*`
  package. Use the installed primitives in `src/components/ui` first. If a screen needs a primitive that is not installed, check the shadcn registry and add it
  with `pnpm dlx shadcn@latest add <name>`. Never hand-write or copy-paste a primitive.
- **Never hand-build a control that shadcn provides.** Outside `src/components/ui`, JSX does not use
  `<button>`, `<input>`, `<select>`, `<textarea>` or `<table>`. Use `Button`, `Input`, `InputGroup`,
  `Select`, `Textarea`, `ToggleGroup` and `Item`. A router `Link` that acts as a control renders
  through `Button render={<Link />}`. A plain text link inside prose stays a plain `Link`. ESLint enforces the
  element ban; the review enforces the rest.
- **No tables.** A collection renders as a list of `Item` inside `ItemGroup`. The list keeps every
  field, navigation path and action that the screen needs on both widths. One collection has one
  rendering: a screen never renders the same data twice behind `hidden md:block` and `md:hidden`.
- **Application components compose primitives.** A screen or the shell can extract a component that
  composes shadcn primitives and takes typed domain props. Introduce a new primitive only when no
  registry primitive and no composition meets the need. Give a component no styling props.
- **Use the stock appearance.** Use the `variant` and `size` props that a primitive already has.
  `className` on a primitive carries layout only: width, flex or grid placement, margin and gap. It
  does not override color, border, radius, typography, height or padding. Never add a variant to a
  file in `src/components/ui`. If a usability or accessibility defect remains after composition and
  layout changes, make the smallest adjustment outside `src/components/ui` and name the defect in the
  commit message.
- **State shows as text.** A status renders as a `Badge` with a stock variant and the state's label.
  Text distinguishes every state without color. Add an icon only when it improves recognition. Theme
  changes go through the tokens in `src/index.css` only.
- **Desktop and mobile are both first-class.** The baselines are 390×844 CSS px (iPhone 14) and
  1280×800. At both baselines, every screen offers the same information and the same actions, with no
  horizontal page scroll. Hover never holds information alone: a `Tooltip` repeats what is visible
  elsewhere. Responsiveness comes from breakpoint classes on layout wrappers, not from a second
  component tree. Navigation and overlay containers can adapt to the width, as `Sidebar` becomes a
  sheet below `md`.
- **A form takes the full width of the content area.** Never cap a form with a fixed width such as
  `max-w-xl`. Below `md` the fields stack in one column. From `md` the field group is a grid of two
  columns, and a wide field, for example a textarea, a metadata set or the action row, spans both
  columns. The field of a form with one field spans both columns.
- **A data list row is compact by default.** A field of a `DataListItem` shows its label and its value
  on one line, and the fields wrap as a flow. A long value wraps inside its field and never widens
  the page.
- **Review at both baselines.** jsdom cannot assert layout. Before approval, the reviewer runs the
  dev server with the mock daemon and exercises each changed screen at both baselines: touch and
  keyboard use, focus, overflow, long content, and the empty, loading and error states.

## Tests

- One `*.test.ts` or `*.test.tsx` beside the unit it covers. `src/foo/bar.ts` is covered by
  `src/foo/bar.test.ts` in the same directory.
- Import `describe`, `it`, `expect` and `vi` from `vitest` explicitly. There are no globals.
- Query by accessible role, label or text. A test that queries a class name or a test id asserts
  markup rather than behaviour, and a snapshot is not an assertion.
- Fake the `src/api` resource the screen calls. Never fake `fetch`.
- Hermetic: no network, no timer left running, no state carried between tests. Cleanup is automatic
  through `test/setup.ts`.

## Commands

Run every one of these from the repository root.

| Purpose        | Command             | Pass signal                        |
| -------------- | ------------------- | ---------------------------------- |
| Types          | `pnpm typecheck`    | exit 0, no `tsc` output            |
| Tests          | `pnpm test`         | the verbatim vitest pass line      |
| Lint           | `pnpm lint`         | exit 0 — 0 errors, warnings at cap |
| Formatting     | `pnpm format:check` | `All matched files use Prettier …` |
| The whole gate | `pnpm verify`       | all four green                     |

`pnpm lint` caps warnings with `--max-warnings`. The cap is a ratchet: a new warning fails the gate.
Lower the cap when you remove debt; never raise it.

`.husky/pre-commit` runs `lint-staged` and then `pnpm verify:guards`, so a lane, snapshot or
persona-sync failure cannot reach a commit.
