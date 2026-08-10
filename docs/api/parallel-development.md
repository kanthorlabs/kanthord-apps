# Building the UI before the daemon is ready

The owner has decided that the client builds now, in parallel with the engine, and integrates later.
This document says how, and it is binding on every agent that writes UI code.

The rule it exists to enforce: **the apps repository never declares its guesses to be the wire
contract.** The engine owns machine-readable schemas, and a mock HTTP daemon stands in for the real one
until each handler satisfies the same executable contract.

The SDK stays thin: one model per wire shape, read directly by the UI. There is no mapping layer and no
view-model layer. Read "The SDK is thin" below for the design and the trade it accepts.

## What the daemon can do today

Two operations: `GET /v1/health` and `GET /v1/db/status`. Every other declared operation answers
`501 not-implemented`. Read [README.md](README.md).

A schema is a separate question from a handler, and the two have separated. 23 of 54 operations now
carry a schema and a validated example in `contract/`, and most of them still answer `501`. So a model
is buildable long before its screen has a daemon behind it.

So integration is not a step at the end. It is one operation at a time, as each handler lands.

## Three lanes, and only one of them waits

### Lane A — starts now, zero engine dependency

Nothing here needs a schema, a handler, or a decision.

- `api_config.dart`, `api_exception.dart`, the error-envelope decoding, `token_provider.dart`.
- The auth, retry, idempotency and logging interceptors.
- `EventPoller`: the cursor loop, the drain rule, the four failure classes, cancellation, backoff.
- The mock daemon of the next section.
- Every design system component: `KDInputField`, `KDButton`, `KDDialog`, `KDPaneView`.
- The router, the `go_router` configuration, `get_it` registration, the app shell and navigation.
- Every bloc state, every empty, loading, error and permission-denied rendering.
- `daemon_connect`, against the **real** daemon. `system.health` works today, so this feature is never
  simulated, and it proves the transport before any UI depends on it.

Three of those are less contract-independent than they look, and each needs the contract document
beside it rather than a guess:

- **Retry** depends on which operations are replay-safe. Read the retry section of
  [errors.md](errors.md). `GET` always, a keyed `POST` yes, nothing else.
- **`EventPoller`** depends on the cursor, the timeout and the cancellation semantics. Read
  [polling.md](polling.md). Build it against the mock, and do not invent a resume rule.
- **Logging** must never print a bearer token, an `Idempotency-Key`, a credential in a
  `provider.register` body, or a `credential-rejected` detail. Redact by field name, and add a test.

### Lane B — open for 23 operations, waiting for 31

`lib/api/models/`. The engine authors zod request and response schemas **without implementing a single
handler**, because its architecture already puts every schema in `src/http/contract/`. That is
`kanthord-engine/.agent/plan/epics/004.5-contract-schemas.md`, and its first slice has landed.

**Open now.** Write the model, the resource method and the decode test for every operation that carries
a schema in `contract/`. Read [README.md](README.md) for the per-feature table. The whole of `system`,
`project`, `repository`, `plan` and `provider`'s read set is in that group, plus `node.list`,
`node.show`, `edge.list` and `event.list` — which is `EventPoller`'s wire shape, so lane A's poller can
now be tested against the real envelope.

Take the shape from `contract/features/<name>.yaml` and the fixture from `contract/examples/<op>.json`.
Copy an example into `test/mock_daemon/fixtures/` rather than inventing bytes; the engine validated it
against the schema in a test.

**Still waiting.** `agent`, `attempt`, `binding`, `blob`, `gitOperation`, `instructions`, `profile`,
`run`, `template`, `worker`, and the operations the table marks as having no schema. The next section
binds for these.

One model per wire shape — there is no DTO-and-model pair, because there is no mapping layer.

### Lane C — waits, and cannot be simulated away

Anything that needs a real handler: field-level correctness, pagination against real volumes, real
latency, and the errors the daemon actually emits versus the ones we predicted. The contract tests
below are what make these cheap when they arrive.

## The mock daemon, not an app-level fake

**Build a fixture-backed HTTP server on loopback. Do not build a fake `KanthordApi`.**

A fake resource class returns models directly and therefore proves only that Dart compiles. The real
Dio path is where the defects are: URL and query serialization, the bearer and client-version headers,
the request body, the status code, every interceptor, cancellation, the timeouts, cursor paging, and
the error envelope. A mock HTTP server exercises all of it with the production client unchanged.

It is also less code. One generic server routes every operation from a fixture directory. Per-resource
fakes duplicate routing and duplicate registrations.

```
test/mock_daemon/
├── mock_daemon.dart          # HttpServer on 127.0.0.1:0, returns its port
├── scenarios/                # named states: empty, populated, blocked-node, degraded
└── fixtures/                 # one JSON file per operation and scenario
```

Requirements:

- Bind `127.0.0.1:0` and report the assigned port. Never a fixed port, or two tests collide.
- Enforce the contract it stands for: reject a request with no bearer token with a real
  `401 unauthenticated` envelope, answer `501 not-implemented` for an operation that has no fixture,
  and answer the error envelope shape for every failure. A mock that is more permissive than the daemon
  teaches the client to be wrong.
- Serve the scenarios a happy path never produces: an empty list, a node in every state including
  `blocked` with each of the five block reasons, a waived edge, a large graph for layout, each of the
  22 error codes, a slow response, and a connection that closes mid-body.
- Support the cursor. `after` and `limit` must page a real fixture list, or `EventPoller` is untested.

A small in-memory fake of a resource interface is still fine for a **bloc unit test**. It is not the
integration surrogate.

## Do not write a model for an operation that has no schema

The right answer to "this schema does not exist yet" is **sequence, not architecture**. EPIC 004.5
depends only on the engine's domain enums and its route registry, both of which are complete and
committed, and it writes no behaviour and touches no database. So each slice lands quickly, and a model
written against it is written against an authored schema rather than against prose.

The rule is per operation, not per repository. A schema in `contract/` is authority: build on it today.
An operation absent from the schema table has none, so write no model for it and wait for the next
snapshot. Lane A still holds weeks of work that needs no shape at all.

Four things prose cannot tell you, and each is a real wire decision the engine must make: required
versus optional, absent versus explicitly `null`, whether an enum is closed, and the shape of `details`
per error code. There is no client-side way to answer them, and a mapper does not answer them either —
it only moves the guess.

If the schedule genuinely cannot wait, a model may be written early under two conditions and no others:
it lives in `lib/api/models/` like any other model, and the engine owner reviews the shape before a
screen consumes it. A shape nobody on the engine side has read is a fork.

## The SDK is thin: one model, and the UI reads it

The owner's constraint is a thin SDK, simple to implement, and `CLAUDE.md` already fixes the design:
no repository, no use case, no entity-plus-DTO pair, one model serving the wire and the UI, a bloc
calling the SDK directly.

**That is the design. There is no mapping layer, and no view-model layer.**

An earlier draft of this document said a wire model may enter a bloc but never a widget. That rule does
not hold: if the state exposes `List<Node>`, the page must read `node.title` to render it, and the page
is a widget. The rule was either unenforceable or a mapping layer with the name filed off. It is
withdrawn.

The honest design, and the trade it accepts:

- **Default: the state holds the wire model, and widgets read it.** `NodeListState.loaded(List<Node>)`
  is correct. A row widget may take a `Node`. This is thin, it is one representation, and it accepts
  that a wire change touches the widgets that read the changed field.
- **Exception, decided per screen: project into the state** when a field is volatile or a row widget is
  reused widely. Project to primitives or a Dart record, **inside the state file**:

  ```dart
  typedef NodeRow = ({String id, String title, String stateLabel, bool isBlocked});
  ```

  This is a projection, and calling it one is the point. It adds no file, no class, no interface and no
  `get_it` entry. It is a local judgement per screen, not an architecture.

- **Never**: a mapper file, a repository interface, a use case, an entity beside a DTO, or a second DI
  registration. `CLAUDE.md` forbids each, and none of them is needed.

A wire change is then a compile error at the sites that read the changed field. That is a mechanical fix
and the right failure mode. Read the next section for the changes that are **not** compile errors,
because those are the ones that need a test rather than a type.

## What the compiler will not catch

Four wire changes break at runtime, not at build time. Every one of them needs an assertion in the
contract suite, because no amount of app architecture prevents them.

- **A wire rename that keeps the Dart property name.** `@JsonKey(name: 'blockReason')` deliberately
  decouples the two, so renaming the wire field and updating the annotation compiles everywhere and
  decodes nothing. **So the contract suite asserts wire field names against the engine's example, not
  just that decoding succeeded.**
- **A field that becomes nullable**, or that stops being sent. It decodes to null and surfaces as a
  null-check failure or an empty widget.
- **An unknown enum value.** [conventions.md](conventions.md) requires a tolerant fallback for exactly
  this reason. Assert the fallback with a test that feeds an unknown value.
- **A daemon older or newer than the client.** Compile-time checking says nothing about the process on
  the other end. [blockers.md](blockers.md) E6 is the missing policy.

## Sequencing removes guessing, not provisionality

EPIC 004.5 gives both repositories one executable authority instead of two readings of the same prose.
That is the whole of its value, and it is large. It does not make the contract stable, and this document
should not pretend otherwise.

The epic is a draft, and it authors schemas ahead of the handlers. A schema validated against its own
examples proves that the examples match the schema. **It does not prove that a handler emits them.** The
contract can still move when implementation finds an ambiguity the prose missed, when the pagination or
nullability choice proves impractical, or when a screen turns out to need a field the response omits.

So the protections that matter are contract controls, not application layers:

- Pin the SDK to a published artifact identified by daemon version and commit. [README.md](README.md)
  records both.
- Generate models from that artifact where practical, so exactly one wire representation exists.
- Validate a real handler's response against its registered schema, in the engine, in the epic that
  implements the handler. That is the assertion 004.5 cannot make.
- Run the contract suite against the live daemon per operation, covering nullability, unknown fields,
  unknown enum values and the error envelope.
- State the compatibility policy. [blockers.md](blockers.md) E6.
- Detect a breaking change between two published artifacts. This one needs CI, which this repository
  does not have yet, so until then the commit pinned in `contract/manifest.json` is the mechanism.

## Contract tests are executable now, and never skipped

A skipped test is not a gate. It rots for months and then fails all at once.

Write one suite that asserts the client's belief about each operation. Run it against the **mock daemon
on every `make test`**, from today. Run the identical suite against a live daemon per operation as its
handler lands — the day `project.list` answers, that operation's row goes green and its fixture is
proved.

The suite asserts four separate things, and conflating them is why "compare against a live daemon"
usually fails:

1. **Schema conformance.** The response decodes, and no required field is missing.
2. **Request serialization.** The path, the query, the headers and the body are what the operation
   declares.
3. **Semantics.** A cursor pages, a `501` is a `501`, an error carries the declared code.
4. **Seeded scenarios.** A deterministic assertion needs controlled ids, controlled ordering and
   controlled state, so it needs a daemon setup mechanism. Until the engine offers one, assert on shape
   and on the fields a test controls — never on a live id or a live timestamp.

Do not expect a live response to equal a fixture byte for byte. Ids are minted, and a command mutates
state.

**Keep the mock after integration.** It stays the substrate for deterministic UI tests, screenshots,
accessibility runs and every failure scenario a real daemon will not produce on demand.

## Simulation must be impossible to mistake for the real thing

This is the way this plan fails badly. Not a field mismatch — a polished build where writes appear to
succeed and reach nothing, demonstrated or shipped as working. `daemon_connect` makes it worse, because
the app can truthfully report "connected" while every other screen is fictional.

An `envied` flag and a `get_it` registration are not enough. All six of these are required.

- A **separate entrypoint or build flavor** for the simulated build. Not a runtime flag on the
  production entrypoint.
- The mock daemon and every fixture live under `test/`, so they are **not linked into a release build**.
- A **compile-time assertion** that a release build cannot select a simulated dependency. Assert it in a
  test that inspects the production composition root.
- A **persistent, unmistakable "Simulated data" marker** in the UI whenever a simulated source is
  active. Persistent, not a toast.
- **Capability reporting per feature, not per daemon.** "Connected" is not "this screen works". Probe
  the operation and render `501` as "the daemon does not do this yet" — that is what
  `ApiNotImplementedException` is for. A user must never see a working screen backed by nothing.
- A test proving the production composition root **cannot** resolve a simulated implementation.

## What this delivers, and what it does not

Delivered and reviewable for real: layout, navigation, theming, state machines, error rendering, empty
and loading states, accessibility, the whole transport, and one feature against a live daemon.

Not proved until lane C: field-level correctness, real pagination volumes, real latency, and the real
error set. The contract suite is what converts each of those from a rewrite into a fixture edit.
