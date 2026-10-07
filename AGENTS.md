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
- **A labelled searchable select is `SearchChoiceField`.** It lives in `src/components` and takes a
  list of strings, an optional `labelOf`, a description and an actions slot. A form field never wires
  a `Combobox` of its own. A feature component that needs a searchable field composes
  `SearchChoiceField`, as `CredentialCombobox` does.
- **Content that a control shows and hides renders through `Reveal`.** It lives in `src/components`
  and animates the height and the opacity, with no motion under `prefers-reduced-motion`. A
  `Collapsible` with its own trigger renders its panel through `RevealPanel` from the same file. A
  screen never writes its own show or hide transition.
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

## Resource screens

The `## Resource screens` section is normative. A change that breaks a rule in it is a defect.

A resource that holds records has three screens: the list at `/<section>`, the form at
`/<section>/new` and the detail at `/<section>/:name`. The actions of a record live on the list and
the detail. `src/features/credentials` is the reference implementation. When the same screens serve
several sections, one feature takes the section as a prop from its route.

### The list

- **One toolbar row sits above the list.** The filters come first, then the toggles, for example
  `Include archived`, then the create button at the right end. The controls have equal height. Below
  `md` the toolbar wraps and a filter takes the full width.
- **A filter reads its options from the server.** It offers `All <things>` first. No constant in the
  client repeats a set that the server answers.
- **The list is a `DataList` of `DataListItem` rows.** It shows the empty, loading, error and pager
  states. The error state offers Retry. The empty text names the next step, for example "No
  credentials. Create the first one with New credential."
- **A row opens the detail of its record.** The row holds no action that leads to the same route.
- **A row shows the name as its title, its states as badges and its key facts as fields.**
- **A row holds only the non-destructive actions of its record**, for example Verify, Rotate and Edit
  metadata. A destructive action never sits on a row.
- **An ended record is hidden by default.** A toggle includes it. Its row shows its end mark and its
  end time, holds no action and still opens the detail.

### The form

- **The fields follow the order of the decision.** The name comes first, then the kind, then the
  main input, then the optional settings. A field that depends on another field appears only after
  that field has a value.
- **The client validates what the server validates, before it sends.** This includes the reserved
  names. The message names the rule and the way out, for example "The name check is reserved. Choose
  another name."
- **The action row is the last row and spans both columns.** A secondary action, for example Verify,
  sits on the left with its badge. Cancel and the primary submit sit on the right, in that order.
  Below `sm` the row stacks: the secondary action on top, then the primary submit, then Cancel.
  Below `sm` every button of the row takes the full width, and the badge of the secondary action
  takes its own row under that action.
- **The check and the submit stay disabled until every required field holds a value.** A line above
  the action row names the missing fields, for example "Fill Name and API key to verify and create."
  The format rules still run on the click and show their messages.
- **The submit label names its result**, for example `Create credential` or `Start sign-in`.
- **A check before the save stores nothing.** It runs on the typed input and shows the same badge as
  the matching action of the detail. A change of any checked input resets the badge.
- **The form shows its check for every kind that takes a typed input.** A kind that the server
  cannot check gets the check disabled, under the disabled-action rule below. A kind without a typed
  input, for example a sign-in, gets no check.
- **A successful submit opens the detail of the new record.** Cancel returns to the list.

### The detail

- **A header section names the record.** It shows the name, the kind badge and the state badges.
  The header row holds the actions: the non-destructive actions first, the destructive action last.
- **Each further section has a heading**, for example Health, Revisions or Bindings. A list of the
  records that depend on this record links each item to the screen of its owner.
- **An ended record shows its sections and offers no action** that the server refuses for an ended
  record.

### The actions

- **An edit opens a `Sheet`.** The screen stays visible behind it. A successful edit closes the sheet
  and reloads the list or the detail.
- **A destructive or irreversible action opens an `AlertDialog`.** The dialog names the consequence in
  the human's words and names the safer path. The pre-flight guard of `## Architecture` applies. A
  success shows a toast that states what ended.
- **A check shows its result as a status badge.** The badge reads `Checking` while busy, then the label
  of the state. The badge keeps the layout still, so a result moves no other control. A failed
  request shows a toast with the error and a Retry action.
- **An action that a kind cannot serve stays visible and disabled on every screen.** A `Tooltip`
  states why, and a tap opens it as a hover does. This rule overrides the rule of `## Architecture`
  that a control the daemon is certain to refuse is not rendered.
- **Action controls align right from `md` and left below `md`.** This holds for row actions, header
  actions and the create button of a toolbar. A heading and its actions share one row from `md` and
  stack below `md`, with the actions under the heading.
- **The state of an action lives in a hook beside its screen**, for example `use-credential-rotate.ts`.
  The sheet, the dialog and the button only render that state.

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
