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
