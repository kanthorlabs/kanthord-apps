# Wire conventions

Rules that apply to every operation. Each one is a decision the client must encode once.

## JSON field names are camelCase

Every documented payload uses camelCase: `blockReason`, `discardReason`, `waivedAt`,
`fromRevision`, `importId`, `documentsHash`, `validatedRevision`, `appliedAt`, `subjectKind`,
`actorKind`, `landingOid`, `expectedRemoteOid`, `candidateRevision`, `invalidatedAt`,
`authoritative`, `parentRun`.

**`field_rename: snake` is removed from `build.yaml`.** It was wrong for this API and it would have
renamed every field in every model. Do not put it back.

Do not replace it with `field_rename: none` and rely on the Dart field name matching the wire name.
Dart camelCase and JSON camelCase agree today, and they will disagree the first time a field is an
acronym or a reserved word. Annotate explicitly with `@JsonKey(name: '...')` on every field. It is more
typing, and it puts the wire name in exactly one declared, greppable place per field.

**It does not make a wire rename a compile error.** The annotation is what decouples the Dart property
from the wire key, so a rename either decodes to null silently, or gets fixed in the annotation and
compiles everywhere with no other call site touched. Neither is a build failure. **So the contract suite
asserts the wire field names against the engine's published example**, and that assertion is the only
thing that catches a rename. Read "What the compiler will not catch" in
[parallel-development.md](parallel-development.md).

`build.yaml` keeps `include_if_null: false`, so a null field is **omitted** from a request rather than
sent as `null`. That is the safer default against a `z.strictObject`, whose optional field accepts an
absent key. It is only a default: absent versus explicitly `null` is one of the four decisions the engine
makes per field in EPIC 004.5, and a field the engine declares nullable-and-required must be sent as
`null`. Annotate that field with `@JsonKey(includeIfNull: true)` when the schema says so.

## Identity is a prefixed ULID

Every resource identity is an entity prefix, an underscore, and a ULID.

| Prefix                               | Names                       |
| ------------------------------------ | --------------------------- |
| `project_`                           | a project                   |
| `repo_`                              | a repository                |
| `initiative_`, `objective_`, `task_` | a node, one prefix per kind |
| `revision_`                          | a plan revision             |
| `import_`                            | a client-minted import id   |
| `run_`, `attempt_`                   | execution records           |
| `provider_`                          | a credential provider       |

A node takes one prefix per kind, so the level is visible without a lookup. A request that names the
wrong level is `422 identity-kind-mismatch`.

Model an id as a plain `String`. Do not write a wrapper type per kind: `CLAUDE.md` forbids an
entity-plus-DTO pair, and a typed-id class per prefix is the same weight for less value than
`@JsonKey`.

A name is never a path segment. A name is a query filter. A rename never changes a URL. A body that
references another resource carries its id, never its name.

## Paths

Every path starts with `/v1`. **Every resource segment is singular**: `GET /v1/repository` lists
repositories. Singular describes the spelling, not the cardinality. Do not "correct" a path to a
plural.

A path segment is one of five kinds: resource, subresource, action, system, parameter. An action is a
`POST` on a resource: `POST /v1/node/:id/unblock`. A command that replaces a whole binding is `PUT`.
A query is `GET`.

`/v1` is unreleased, so a path spelling can still change. Pin the snapshot commit in
[README.md](README.md) and re-read it before a contract refresh.

## Paging is a cursor, never an offset

`after` takes the **id of the last row read**, and `limit` caps the page. An offset cannot page an
append-only log that grows while a human reads it.

Documented on `event.list` only. Assume it for every future list route, and do not build offset
pagination anywhere.

**Order carries no gap information.** A ULID is not dense, so two adjacent ids do not prove nothing
is missing between them. Never assert a contiguous sequence and never compute a count from two ids.

## Large payloads are blob hashes

A route returns small fields inline and a hash for each large one: a rendered prompt, a tool trace, a
diff, a check log, a reviewer reason, approval evidence, a plan document, a profile document, an
error detail. The client fetches what it needs from `GET /v1/blob/:hash`.

One attempt record holds a rendered prompt, a check log and a diff. Three attempts multiply it. A
screen that shows a verdict must not download megabytes to find it, so **fetch a blob lazily, on the
user opening it, never eagerly with the parent model.**

The blob contract:

- The path parameter is the hash exactly as the citing field returned it, including the algorithm
  prefix: `GET /v1/blob/sha256:9f2a…`. Never strip the prefix and never percent-encode the colon.
- The response body is the payload **bytes**. `Content-Type` is `application/octet-stream` unless the
  citing field declares a narrower one. The daemon never sniffs content.
- So the SDK method returns bytes or a string, never a model. Decode by what the citing field says
  the blob is. A tool trace and a plan document are text; treat the rest as bytes until a field
  declares otherwise.
- `ETag` is the quoted hash. `Cache-Control` is `private, immutable` with a long lifetime. A blob is
  content-addressed, so cache it by hash and never revalidate.
- A `Range` request is answered, because a check log runs to tens of kilobytes.
- The bearer token applies. A hash is not a capability.
- An unknown hash is `404 not-found`, and it means the hash was never stored, not that it expired.

## The client version header

Send `X-Kanthord-Client: <version>` on every request. The daemon reports its own version on
`GET /v1/status`.

## Version compatibility is undefined

The engine states that the CLI can be older than the daemon and that the daemon serves one version
at a time. It states nothing else. Specifically, no engine document answers:

- which client and daemon version pairs are supported;
- what the daemon does with an unsupported `X-Kanthord-Client`;
- whether a response may gain a field within `v1`;
- whether a client must tolerate an unknown enum value.

Until the engine answers, the client takes the tolerant position, because it is the only one that
cannot break on a daemon upgrade:

- **Ignore an unknown JSON field.** Never fail a decode on one.
- **Tolerate an unknown enum value.** Model every wire enum with an explicit unknown fallback and
  render it as its raw string. Never throw.
- **Compare the daemon version from `/v1/status` and warn on a mismatch.** Do not block.

This is a caveat, not a contract. Raise it with the engine owner. See [blockers.md](blockers.md).

## Closed value sets

Tolerate an unknown value in each, per the rule above.

Node kind: `initiative`, `objective`, `task`.

Block reason: `attempt-limit`, `dependency-discarded`, `stale-base`, `dirty-recovery`, `e2e-failed`.
It appears as `blockReason` on a node representation and is set when the state is `blocked`.

Terminal node state: `done`, `partial`, `discarded`.

Attempt outcome: `accepted`, `rejected`, `failed`, `timed-out`, `cancelled`.

Check result: `running`, `passed`, `failed`, `error`, `timed-out`, `cancelled`, `not-applicable`.
The result is explicit and is never inferred from an exit status. A killed command has no exit code
at all, so render `timed-out` from the field and never from a missing exit status.

Dependency status on `system.health`: `ok`, `failed`, `not-implemented`.

Health roll-up: `ok`, `degraded`.

Worker kind: `general@1` is the only one in the MVP.

The full node state list is in the engine at `docs/proposal/phase-1/state-machine.md`. It is not
copied here, because it is the one set most likely to move before `v1` releases. Read it from the
engine at the pinned commit when a screen needs to render every state.

## The daemon owns state

No route accepts a state field. Every transition is an action route — `unblock`, `waive`, `abandon`,
`discard`, `approve`, `reconcile`, `publish`, `rename`. **Never add a `PATCH` and never model a node
state as writable.** A state field a client writes cannot express what the daemon must refuse.

## No request carries an actor

The daemon stamps the configured actor name on every human decision. Do not send an actor and do not
build an actor picker.

## No route names a file path on the server

Every document travels in the body. `plan.import` sends its documents, `plan.export` returns them.
The client writes no file on the daemon, and the daemon writes no file on the client.
