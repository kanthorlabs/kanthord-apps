# The kanthord API contract

This directory is the client-side copy of the daemon contract. It answers the first blocker in
`../../HANDOFF.md`: endpoints, request shapes, response shapes, error codes, auth, and streaming.

## Provenance

| Field                 | Value                                                              |
| --------------------- | ------------------------------------------------------------------ |
| Source repository     | `kanthord-engine`                                                  |
| Daemon version        | `27.8.1`                                                           |
| Engine commit         | `a5b957dc9cac64ee5f8fa292f85cd3e3b2d939de`                         |
| Snapshot date         | 2026-08-05                                                         |
| `openapi.yaml` sha256 | `e6f037709fd5b5575f4d148b8e4427309bb892b8d4f283f1c62fe9d35f843278` |

Regenerate `openapi.yaml` from the engine checkout at the commit above:

```bash
cd kanthord-engine
printf 'import YAML from "yaml";\nimport { buildOpenApiDocument } from "./src/http/contract/openapi.ts";\nprocess.stdout.write(YAML.stringify(buildOpenApiDocument(), { lineWidth: 0 }));\n' > .gen-openapi.mts
node .gen-openapi.mts > ../kanthord-apps/docs/api/openapi.yaml
rm .gen-openapi.mts
```

The engine does not commit `openapi.yaml`. This repository commits a snapshot, because the client
must build against a fixed contract. Update the four provenance fields above with every refresh. A
snapshot with a stale commit is worse than no snapshot.

## Read this first: the daemon serves two operations today

The registry declares 53 operations. The daemon wires **two** handlers: `system.health` and
`system.db`. Every other operation answers `501 not-implemented` and writes no state.

| Class                                | Count | Behaviour today                       |
| ------------------------------------ | ----- | ------------------------------------- |
| Live                                 | 2     | `GET /v1/health`, `GET /v1/db/status` |
| Declared and `routed`, no handler    | 20    | `501 not-implemented`                 |
| Declared and `stubbed` (later phase) | 31    | `501 not-implemented`                 |
| `post-mvp`, no route                 | —     | `404 not-found`                       |

`501` and `404` mean different things. `501` says the daemon will do it, not yet. `404` says this
daemon does not have the operation. See [operations.md](operations.md).

So `openapi.yaml` is a **route directory, not an interoperability contract**. Two of 53 operations
carry a response schema. It cannot generate models. It fixes the paths, the methods, the bearer
scheme, the error envelope, and the lifecycle. [operations.md](operations.md) is the more honest
document until the engine adds schemas.

## Documents

| File                                               | Holds                                                                    | Unblocks                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------- |
| [operations.md](operations.md)                     | Every operation, its state today, and the resource grouping              | `resources/` layout                            |
| [errors.md](errors.md)                             | The error envelope, the 21 codes, the exception mapping                  | `api_exception.dart`                           |
| [auth.md](auth.md)                                 | The static-token model. There is no sign-in and no refresh               | `auth_interceptor.dart`, `token_provider.dart` |
| [conventions.md](conventions.md)                   | camelCase, identities, paging, blobs, the version header                 | `models/`, `api_config.dart`                   |
| [polling.md](polling.md)                           | Long polling replaces SSE. The delivery protocol and the failure classes | `lib/api/polling/`, the step-5 scope           |
| [connectivity.md](connectivity.md)                 | Base URL per platform, the `Host` allow list, browser access             | `api_config.dart`                              |
| [blockers.md](blockers.md)                         | The decisions the owner must make, and the engine work each needs        | Steps 4 and 5                                  |
| [parallel-development.md](parallel-development.md) | How the UI gets built before the daemon is ready                         | **Read this before writing any UI**            |
| `openapi.yaml`                                     | The generated route directory                                            | Route discovery only                           |

## Start here if you are about to write code

**[parallel-development.md](parallel-development.md)** is the working plan. The daemon serves two
operations, and the owner has decided the client builds in parallel and integrates later. That document
splits the work into three lanes, and only one of them is blocked on the engine.

The short version: build the whole transport, the design system, the router and every view state now,
against a **fixture-backed mock HTTP daemon on loopback** — not against a fake `KanthordApi`, because a
fake proves only that Dart compiles. Build `daemon_connect` against the real daemon, because
`system.health` works today. Do not hand-write a wire model and call it the contract; the engine authors
schemas ahead of its handlers in EPIC 004.5, and that is what models are generated from.

## What this handover does not do

- It does not gain `models/` yet. 51 operations have no schema, and
  [parallel-development.md](parallel-development.md) says what to do in the meantime and what not to do.
- Step 5 is `daemon_connect`, the token and base-URL provisioning flow. The chat feature is removed
  from the MVP in both repositories: the daemon has no prompt route and no stream, in any phase. Read
  [blockers.md](blockers.md) R1 for the invariant.

## Owner decisions already taken

Each one is written into the document that owns it, and each has an engine EPIC where engine work is
needed.

| Decision                                                                                  | Where it lives                                     | Engine work                                                         |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| Flutter web is supported. The daemon gains an allowed-origin list, empty by default       | [connectivity.md](connectivity.md)                 | `kanthord-engine/.agent/plan/epics/010.5-browser-access.md`         |
| Long polling replaces SSE. The SSE client is withdrawn                                    | [polling.md](polling.md)                           | `blockers.md` E5, for the daemon-side wait                          |
| An `Idempotency-Key` header makes a `POST` retryable. Memory cache, TTL default 5 minutes | [errors.md](errors.md)                             | `kanthord-engine/.agent/plan/epics/010.6-idempotent-post.md`        |
| No chat feature in the MVP. No prompt route, no stream, in either repository              | [blockers.md](blockers.md) R1                      | None. It is a refusal, recorded in `docs/proposal/after-the-mvp.md` |
| The client builds the UI in parallel and integrates per operation                         | [parallel-development.md](parallel-development.md) | `kanthord-engine/.agent/plan/epics/004.5-contract-schemas.md`       |
