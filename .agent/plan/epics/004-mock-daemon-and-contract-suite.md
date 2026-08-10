# EPIC 004 — The mock daemon and the contract suite

Status: **ready**.

`docs/api/parallel-development.md` is binding: the client builds against a fixture-backed HTTP daemon
on loopback, never against a fake `KanthordApi`. This epic builds that daemon, the suite that runs
against it on every `make test`, and the three release-safety guards that need no integration
harness.

## Goal

- **G1** — `test/mock_daemon/mock_daemon.dart` binds `127.0.0.1:0`, reports the assigned port, and
  serves a fixture directory. It uses `dart:io` `HttpServer` and adds no dependency.
- **G2** — The daemon enforces the contract it stands for: no bearer token is a real
  `401 unauthenticated` envelope, a routed operation with no fixture is a real `501 not-implemented`,
  an unrouted path is `404 not-found`, and every failure carries the envelope shape.
- **G3** — The daemon enforces the cursor schema of `src/http/contract/cursor.ts`: `limit` defaults to
  100 and caps at 500, `limit` outside `1..500` is `400 invalid-request`, an empty `after` is
  `400 invalid-request`, an unknown query key is `400 invalid-request`, and `after` selects every
  fixture row whose id sorts after it, ordered ascending.
- **G4** — `test/mock_daemon/scenarios/` names the states a happy path never produces: an empty list,
  one directory per error code the contract uses, a slow response, a connection closed mid-body, and
  a `503`.
- **G5** — `test/api/contract/` holds the suite. Per operation it asserts four things separately and
  names which one failed: decode conformance, request serialization, semantics, and the wire field
  names against the published example. It is never skipped.
- **G6** — The suite runs against the mock by default, and against a live daemon when
  `KANTHORD_LIVE_BASE_URL` and `KANTHORD_LIVE_TOKEN` are both set. The live lane covers read
  operations only.
- **G7** — Three release-safety guards hold: every fixture lives under `test/`, no file under `lib/`
  imports a path under `test/`, and the production composition root resolves no type from the
  simulated set.

## Non-goals

- No fake `KanthordApi` and no per-resource fake. A bloc unit test may still use a small in-memory
  fake, and that is not this daemon.
- No fixture invented by hand. Every fixture is copied from `contract/examples/`. A scenario the
  examples do not cover is derived from one and names its parent.
- No model and no resource method. EPIC 006 owns those. The suite ends this epic with the two rows
  EPIC 001 delivered.
- No live assertion on a stateful operation. `project.create`, `repository.register` and
  `plan.import` mutate a daemon, and the engine offers no setup and no cleanup mechanism. The live
  lane reads and never writes.
- No full OpenAPI validation. The suite decodes an example and asserts field names. It does not
  enforce a pattern, a bound or `additionalProperties`. Say what it proves and no more.
- No daemon-side wait and no `wait` parameter. `docs/api/blockers.md` E5 is engine work.
- No simulated entry point, no simulation marker and no per-feature capability reporting. Those need
  a simulated screen and a running harness, and `docs/tdd.md` says the harness does not exist.
- No stateful command handling. The mock replays fixtures and runs no state machine.

## Verification gate

Gates: `make verify`

Proof:

```bash
make test-one T=test/mock_daemon/mock_daemon_test.dart \
  && echo "PASS 004-G1-SERVER" \
  && make test-one T=test/mock_daemon/contract_enforcement_test.dart \
  && echo "PASS 004-G2-ENFORCEMENT" \
  && make test-one T=test/mock_daemon/cursor_test.dart \
  && echo "PASS 004-G3-CURSOR" \
  && make test-one T=test/mock_daemon/scenarios_test.dart \
  && echo "PASS 004-G4-SCENARIOS" \
  && make test-one T=test/api/contract \
  && echo "PASS 004-G5-SUITE" \
  && make test-one T=test/api/contract/live_lane_test.dart \
  && echo "PASS 004-G6-LIVE-LANE" \
  && make test-one T=test/app/release_safety_test.dart \
  && echo "PASS 004-G7-RELEASE-SAFETY" \
  && echo "PASS EPIC-004"
```

Hermetic coverage required beyond the Proof:

- Two mock daemons start at once and take two different ports. No test names a fixed port.
- Every fixture is byte-equal to the matching key of `contract/examples/<op>.json`, or is a named
  scenario that declares its parent example. A hand-edited fixture fails the suite rather than
  teaching the client a shape the engine never published.
- The suite reports the count of covered operations and asserts it. A row removed from the suite
  fails, so the suite cannot shrink silently.
- With no live environment variables the live lane reports "not configured" and passes. It never
  reports a skip, because a skipped gate is not a gate.
- The release-safety test enumerates the production registrations and fails on a name from the
  simulated list. It is a runtime test over the composition root, not a compile-time proof. Say so.

## Stories

- **`MockDaemon`** — `start()` binds `127.0.0.1:0` and returns the instance with its `port` and
  `baseUrl`. `stop()` closes it. Every test registers `addTearDown(daemon.stop)`.
- **Routing** — one table maps a method and a path template to an operation id, derived from
  `docs/api/operations.md`. A parameter segment matches by kind: a prefixed ULID for a resource id,
  and the `algorithm:hex` form for a `blob.show` hash. One universal ULID rule is wrong.
- **The bearer rule** — every route requires the token, `system.health` included. A missing or wrong
  token answers `401` before routing, so a registered path and an unregistered path answer
  identically.
- **The envelope writer** — one function writes `{"error":{code,message,details}}` with the status of
  `docs/api/errors.md`. No handler writes an error body by hand.
- **The cursor** — the strict schema, then the paging. The mock implements `id > after` with an
  ascending sort, exactly as `src/services/event/sqlite.ts` does. An absent `after` starts at the
  beginning with 100 rows. `limit=0`, `limit=501` and a non-integer each answer `400 invalid-request`,
  as does `after=` and an undeclared query key.
- **The absent-id cursor** — three asserted cases, because this is where a client goes silently
  wrong. An `after` **between** two fixture ids returns the rows above it. An `after` **above every**
  fixture id returns an empty page and never an error. An `after` **below every** id returns the whole
  list. Read the `after` section of `docs/api/conventions.md`.
- **Scenarios** — a named directory overlays the default fixture set: `empty`, `populated`,
  `degraded`, `blocked-node`, `slow`, `truncated`, and one per error code. `slow` delays by an
  injected duration. `truncated` closes the connection mid-body.
- **The contract suite harness** — one helper takes an operation id, a `KanthordApi` and the
  published example, and asserts the four things separately. A row is four expectations.
- **The wire-name rule** — a field the schema marks required must appear in the example and in the
  model. An optional field is asserted against the schema in `contract/features/<name>.yaml`, never
  against one example, because an example may legitimately omit it.
- **The live lane** — the same suite pointed at `KANTHORD_LIVE_BASE_URL`, read operations only. It
  asserts shape and the fields the test controls, never a minted id and never a timestamp.
- **The release-safety guards** — the fixture-provenance test, the `lib` must not import `test` rule
  in `scripts/arch-check.sh` with its self-test, and the composition root test.
