# The kanthord API contract

This directory is the client-side copy of the daemon contract. It answers the first blocker in
`../../HANDOFF.md`: endpoints, request shapes, response shapes, error codes, auth, and streaming.

## The contract snapshot: `contract/`

`contract/` is a published snapshot of the engine contract. It is generated, so edit no file in it.

```
contract/
├── manifest.json         # version, engine commit, feature list, operation list
├── features/<name>.yaml  # one self-contained OpenAPI document per feature
└── examples/<op>.json    # one example set per operation with a schema
```

There is no single `openapi.yaml` here any more. One 162 KB document is not readable, by a human or
by an agent. Read the one feature file that holds the operation you implement. Every feature file
repeats the shared `Error` schema and the `bearerAuth` scheme, so one file is enough to write one
resource class.

An example file holds up to four keys, in this order: `query`, `request`, `success`, `error`. The
engine validates each one against the schema in a test, so an example is safe to use as a Flutter
decode fixture.

### Provenance

Read `contract/manifest.json` for the authoritative values. The snapshot in this commit:

| Field         | Value                                      |
| ------------- | ------------------------------------------ |
| Source        | `kanthord-engine`                          |
| Version       | `27.8.1`                                   |
| Engine commit | `a925f37be9d52dedb1c14019c2ab14ce58a84451` |
| Engine tree   | clean                                      |
| Snapshot date | 2026-08-10                                 |

`dirty: false` says the commit reproduces the snapshot. The 2026-08-10 snapshot was first published
from a dirty tree and republished from a clean one at `a925f37`; the two are byte-equal apart from
the provenance. Refuse a snapshot that reports `dirty: true`.

### Refresh the snapshot

The engine owns the generator. Run it from an engine checkout:

```bash
cd kanthord-engine
node scripts/publish-contract.ts ../kanthord-apps/docs/api/contract
rm ../kanthord-apps/docs/api/contract/openapi.yaml
```

The script wipes `features/`, `examples/` and `manifest.json` in the output directory, then writes
them again. It also writes the merged `openapi.yaml`, which this repository does not keep, so the
second command removes it.

The script refuses an output directory that contains the engine repository. `prettier` ignores
`docs/api/contract/`, because the engine formats it canonically.

Update the provenance table above with every refresh. A snapshot with a stale commit is worse than no
snapshot.

## Read this first: the daemon serves two operations today

The registry declares 54 operations. The daemon wires **two** handlers: `system.health` and
`system.db`. Every other operation answers `501 not-implemented` and writes no state.

| Class                                | Count | Behaviour today                       |
| ------------------------------------ | ----- | ------------------------------------- |
| Live                                 | 2     | `GET /v1/health`, `GET /v1/db/status` |
| Declared and `routed`, no handler    | 22    | `501 not-implemented`                 |
| Declared and `stubbed` (later phase) | 30    | `501 not-implemented`                 |
| `post-mvp`, no route                 | —     | `404 not-found`                       |

The three counts total 54, read from the engine registry at `a925f37`: 24 `routed` and 30 `stubbed`.
[operations.md](operations.md) lists all 54.

`501` and `404` mean different things. `501` says the daemon will do it, not yet. `404` says this
daemon does not have the operation. See [operations.md](operations.md).

A `501` is a missing handler, not a missing schema. The two are now separate: **23 of 54 operations
carry a request or response schema and a validated example**, and most of them still answer `501`.

| Feature        | Operations | Operations with a schema                           |
| -------------- | ---------- | -------------------------------------------------- |
| `system`       | 3          | `system.db`, `system.health`, `system.status`      |
| `project`      | 5          | `create`, `list`, `repositories`, `show`, `status` |
| `repository`   | 7          | `inspect`, `list`, `register`, `show`              |
| `plan`         | 4          | `export`, `import`, `revisions`, `validate`        |
| `provider`     | 6          | `list`, `register`, `show`                         |
| `node`         | 10         | `list`, `show`                                     |
| `edge`         | 1          | `list`                                             |
| `event`        | 1          | `list`                                             |
| `agent`        | 1          | none                                               |
| `attempt`      | 1          | none                                               |
| `binding`      | 1          | none                                               |
| `blob`         | 1          | none                                               |
| `gitOperation` | 1          | none                                               |
| `instructions` | 1          | none                                               |
| `profile`      | 4          | none                                               |
| `run`          | 4          | none                                               |
| `template`     | 2          | none                                               |
| `worker`       | 1          | none                                               |

A feature with a schema **can** generate a model and a decode test today, ahead of its handler. A
feature with no schema fixes the path, the method, the bearer scheme and the error envelope, and
nothing else. Do not hand-write a wire model for the second group.
[operations.md](operations.md) still owns the per-operation state.

## Documents

| File                                               | Holds                                                                    | Unblocks                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------- |
| [operations.md](operations.md)                     | Every operation, its state today, and the resource grouping              | `resources/` layout                            |
| [errors.md](errors.md)                             | The error envelope, the 22 codes, the exception mapping                  | `api_exception.dart`                           |
| [auth.md](auth.md)                                 | The static-token model. There is no sign-in and no refresh               | `auth_interceptor.dart`, `token_provider.dart` |
| [conventions.md](conventions.md)                   | camelCase, identities, paging, blobs, the version header                 | `models/`, `api_config.dart`                   |
| [polling.md](polling.md)                           | Long polling replaces SSE. The delivery protocol and the failure classes | `lib/api/polling/`, the step-5 scope           |
| [connectivity.md](connectivity.md)                 | Base URL per platform, the `Host` allow list, browser access             | `api_config.dart`                              |
| [blockers.md](blockers.md)                         | The decisions the owner must make, and the engine work each needs        | Steps 4 and 5                                  |
| [parallel-development.md](parallel-development.md) | How the UI gets built before the daemon is ready                         | **Read this before writing any UI**            |
| `contract/features/<name>.yaml`                    | One OpenAPI document per feature. Read the one you implement             | `resources/`, `models/`                        |
| `contract/examples/<op>.json`                      | A validated example per operation that carries a schema                  | Decode tests, mock daemon fixtures             |
| `contract/manifest.json`                           | The published version, engine commit and operation list                  | Provenance                                     |

## Start here if you are about to write code

**[parallel-development.md](parallel-development.md)** is the working plan. The daemon serves two
operations, and the owner has decided the client builds in parallel and integrates later. That document
splits the work into three lanes, and only one of them is blocked on the engine.

The short version: build the whole transport, the design system, the router and every view state now,
against a **fixture-backed mock HTTP daemon on loopback** — not against a fake `KanthordApi`, because a
fake proves only that Dart compiles. Build `daemon_connect` against the real daemon, because
`system.health` works today. Do not hand-write a wire model and call it the contract: build a model from
a schema in `contract/`, and for an operation that has none, wait for the next snapshot.

## What this handover does not do

- It does not gain `models/` for every operation. 31 of 54 operations still have no schema, and
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
