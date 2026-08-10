# EPIC 000 — API integration overview

This is a map, not a work item. It holds no story and no gate of its own.

Source of truth: `docs/api/README.md` and the documents it lists. Contract snapshot:
`docs/api/contract/`, engine version `27.8.1`, commit `a925f37`, clean.

## What the whole set achieves

After EPIC 007 the client owns:

- a typed SDK for the 24 operations the snapshot specifies — the 23 in `manifest.json` plus
  `blob.show`, which declares a media contract instead of a JSON schema;
- a mock daemon that enforces the contract, and a contract suite that never skips;
- an event poller for the feature that needs one;
- one feature that reaches a real daemon.

**It is not a complete SDK.** 31 declared operations carry no schema, so this set writes no model and
no method for them. Each one costs a model, a method, a fixture and a suite row when its schema
lands — not one suite row.

## The development host

`make dev` runs Chrome at `http://localhost:8080`. No epic in this set needs a simulator or an
emulator, and every human verification step names the browser first. The daemon needs
`KANTHORD_HTTP_ALLOWED_ORIGINS=http://localhost:8080`, which engine EPIC 010.5 already delivers. A
browser window resolves the desktop layout family, which is the family this product targets first.
Read `AGENTS.md`.

## The order, and why it is this order

The live vertical slice comes third, not last. `system.health` works today, so the client can prove
the whole transport against a real daemon before it writes 21 models against handlers that answer
`501`.

| EPIC                                 | Delivers                                                            | Depends on |
| ------------------------------------ | ------------------------------------------------------------------- | ---------- |
| 001 — Transport foundation           | `ApiConfig`, `ApiException`, `TokenProviderType`, auth, `system.*`  | none       |
| 002 — App composition                | `get_it`, `go_router`, token store, base URL store, env             | 001        |
| 003 — `daemon_connect`               | The provisioning flow, live against `GET /v1/health`                | 002        |
| 004 — Mock daemon and contract suite | A fixture-backed daemon on loopback, the four-part suite            | 001, 002.3 |
| 005 — Interceptor stack              | Retry, idempotency, redacting logger                                | 004        |
| 006 — Models and resources           | Every schema-carrying operation, nine resource classes, `blob.show` | 005        |
| 007 — Event poller                   | `lib/api/polling/`, the acknowledged handler, `PollerStatus`        | 006        |

004 may start as soon as 001 lands and runs beside 002 and 003. Its last Story is the exception:
the composition-root guard of G7 inspects the registrations `configureDependencies` makes, so it
needs EPIC 002 Story 03. Ten of the eleven Stories need nothing from 002. `002.3` in the table means
that one Story, not the whole EPIC.

## What the set does not do

- It implements no daemon handler. 22 of the 24 covered operations answer `501` today.
- It writes no model for an operation with no schema.
- It builds no chat surface and nothing that streams from a resource. `docs/api/blockers.md` R1, R2.
- It states no version compatibility policy. `docs/api/blockers.md` E6 is open, so the client holds
  the tolerant position of `docs/api/conventions.md` and warns rather than blocks.
- It builds no simulated application build. `docs/api/parallel-development.md` requires six
  safeguards for one, and three of them need an integration harness that `docs/tdd.md` says does not
  exist. EPIC 004 delivers the three that are cheap and real — fixtures stay under `test/`, `lib/`
  imports nothing from `test/`, and the production composition root resolves nothing simulated. The
  entry point, the marker and per-feature capability reporting land with the first simulated screen.
- It builds no reverse-proxy web deployment. A native target always calls the daemon directly at the
  operator's address and port. A proxy is a browser workaround for one case — an HTTPS-served web
  bundle, which cannot call a plain-HTTP daemon — and `docs/api/connectivity.md` owns it. EPIC 003
  builds direct browser access, where the human types the token.

## Blockers cleared before the set was released to `/author`

Seven blockers and one document defect were found in review and each is now closed in the document
that owns it. Nothing in this list is open, and no epic waits on any of them.

| Was | Subject                                    | Resolution                                                                                                                |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| B1  | The error code list                        | 22 codes, not 21. `service-unavailable` is `503`. The set is open, not closed. `docs/api/errors.md`                       |
| B2  | `project.status`                           | The contract declares `GET /v1/project/:id/status`. The row is in `docs/api/operations.md` and the method is in EPIC 006  |
| B3  | The dirty snapshot                         | Republished from a clean engine tree at `a925f37`. Byte-equal apart from the provenance                                   |
| B4  | `arch-check` banning the poller's `Stream` | The rule narrows to `lib/api/resources/`, with a self-test. `scripts/arch-check.sh`, `scripts/arch-check.test.sh`         |
| B5  | The poller delivery contract               | An acknowledged handler replaces the `Stream`, plus a separate `Stream<PollerStatus>`. `docs/api/polling.md`              |
| B6  | The poller restart position                | Resume from a persisted cursor. A null cursor drains history through the same handler. "Start from now" is withdrawn      |
| B7  | The mobile cleartext posture               | Cleartext is permitted to any host in every build variant. `docs/api/connectivity.md`, `blockers.md` D3                   |
| S1  | `docs/testing.md`                          | The refresh test and the "a `POST` is never retried" rule are replaced by the rules of `docs/api/auth.md` and `errors.md` |

One consequence travels with those answers and is not a defect:

- **The mobile cleartext permission is broad.** The app talks to one plain-HTTP daemon on a host the
  operator names at runtime, so a build-time file cannot narrow it. The token then crosses the
  network in clear text, and the mitigations are the non-loopback warning in EPIC 003 and the network
  boundary — never a platform flag.

The engine cursor schema was read while answering B6 and it bounds the history drain:
`src/http/contract/cursor.ts` caps `limit` at 500 and defaults it to 100, `after` is optional and
refuses an empty string, and the query object is strict. So a first run with no stored cursor is an
ordinary sequence of pages the drain rule already handles, not one unbounded response.

The operation counts were also corrected from the registry at `a925f37`: 54 declared, 24 `routed`,
30 `stubbed`, 23 carrying a schema. `docs/api/README.md`, `operations.md`, `errors.md`,
`blockers.md` and `HANDOFF.md` now agree.
