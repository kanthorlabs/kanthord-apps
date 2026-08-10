# Blockers and the engine work they need

Two lists. The first holds decisions only the owner makes. The second holds engine work the client
needs, and the engine work it must **not** get.

Nothing in this file is a client task. Do not guess any of it.

**The client does not wait for any of it.** Read
[parallel-development.md](parallel-development.md): three lanes, and only one of them is blocked.

## Owner decisions

### D1 — the second feature, after `daemon_connect`

**A chat feature is removed from the MVP, in both repositories.** The daemon ships no prompt route and
no stream, and the engine records the refusal as an invariant in
`kanthord-engine/docs/proposal/after-the-mvp.md`. R1 below states it from the client side. Nothing here
is waiting on that; it is settled.

Step 5 is `daemon_connect` — the token and base-URL provisioning flow of [auth.md](auth.md), verified
against `GET /v1/health`. That is not an owner decision: no screen works without it, and it is the only
slice that reaches a live daemon today.

**What needs a decision is the feature after it**, and the honest position is that every candidate is
blocked on engine work rather than on a product debate.

| Candidate                                  | Needs                                                                 | State                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| A graph read view — projects, nodes, edges | `project.list`, `project.show`, `node.list`, `node.show`, `edge.list` | Phase 1, `501`. Gated on E1 and E2                                                      |
| A plan import client                       | `plan.validate`, `plan.import`, `plan.export`, `plan.revisions`       | Phase 1, `501`. Gated on E1 and E2. The richest product value, and the most client work |
| Run and attempt observation                | `run.*`, `node.attempts`, `attempt.show`, `node.checks`, `blob.show`  | **Engine phase 2, and no phase-2 epic exists**                                          |

So the decision is really a scheduling one: which engine capability gets handlers first, and the client
follows it. Aelita recommends the graph read view, because it is the smallest slice that renders real
domain data and it needs no write path.

Do not start any of them before E1 and E2 land. A screen against a `501` is not a screen.

### D2 — the web target. DECIDED: supported

The owner has decided that Flutter web is supported. The engine gains a browser-access mode — an
allowed-origin list, empty by default — specified in
`kanthord-engine/.agent/plan/epics/010.5-browser-access.md`, with the policy in
`kanthord-engine/docs/proposal/phase-1/transport.md`.

Read [connectivity.md](connectivity.md) for the supported topologies, the pinned development port, the
reverse-proxy path to an HTTPS bundle, and the two web facts that change how the client reports
failure. Three residual items travel with the decision and are not blockers:

- Name and test the supported browsers and versions. "Flutter web" is not a compatibility statement.
- Re-check Private Network Access behaviour per release. The policy is still evolving.
- Accept that a configured origin is an authority, so every script at that origin reaches the daemon.

### D3 — the LAN and cleartext posture

A physical device needs a non-loopback bind, which needs a token, which crosses the LAN in clear text
and never expires. Approve that, or restrict device testing to a trusted network, or fund transport
encryption on the daemon. Read the last section of [auth.md](auth.md).

## What the engine must add

Ordered by what the client is blocked on, not by engine effort.

### E1 — implement the 20 declared-but-unhandled operations

The registry declares 22 operations as `routed`. The daemon wires **two** handlers. The other 20
answer `501`, including `system.status`, `project.list`, `node.list` and `event.list`.

This is the real blocker, and it is bigger than the contract. **A schema does not unblock a screen
that has no handler.** Every other item here is secondary to this one.

### E2 — schemas ahead of the handlers. SPECIFIED, and it is the critical path

31 of 54 operations carry no zod request or response schema, so their feature document generates no
model. The other 23 landed with the 2026-08-10 snapshot. Read `../api/README.md` for the split.

**The unblock is that schema authorship does not depend on handler implementation.** The engine's
`src/http/contract/` is pure — it imports no storage and no command — so every shape can be authored
now, in parallel with the rest of phase 1. That is
`kanthord-engine/.agent/plan/epics/004.5-contract-schemas.md`, and it is the single highest-value item
on this list for the client.

It covers every phase-1 read operation plus the plan import request, and it carries three things the
client needs beyond the types:

- The four decisions prose cannot express: required or optional, absent or explicitly `null`, closed
  enum or open string, and the shape of `details` per error code.
- A validated example per operation, which is what the client's fixtures are built from.
- A published artifact with the daemon version and commit in it, so the client pins rather than copies.

The standing rule for everything outside that slice: an operation is not `routed` until it declares a
request schema, a success-response schema and its error codes. Two carve-outs — `blob.show` returns
bytes and declares a media contract, and a future stream declares an event-envelope schema.

Read [parallel-development.md](parallel-development.md) for what the client builds before, during and
after this lands.

### E3 — examples, published and validated. FOLDED INTO E2

The example set is a story of EPIC 004.5, not a separate ask: one request, one success response and one
error response per operation, authored beside the schema and **validated against it in a test**, then
published in the same artifact.

An example is secondary to the schema — it expresses one case, not the rules — but it is what a Flutter
decode test can actually assert, and it removes the client's need to invent bytes. Give the artifact
release ownership. An example emitted incidentally by a test run and copied by hand is drift waiting to
happen.

### E4 — publish the contract as a release artifact. DELIVERED, one gap left

`kanthord-engine/scripts/publish-contract.ts` writes the artifact: one OpenAPI document per feature,
one example set per operation, and a `manifest.json` that carries the version, the engine commit and
the operation list. The client copies that output into `docs/api/contract/`.

The gap is release ownership. The script runs on demand from a working tree, so it can publish a
dirty tree, and the 2026-08-10 snapshot did. Bind the publish to a tagged release, and refuse a dirty
tree. The client then pins an artifact rather than copying a local generation result.

### E5 — a daemon-side wait on `event.list`

The owner has decided that the client uses long polling, so SSE is off the table on both sides. The
client-side design is [polling.md](polling.md), and it works today with plain interval polling. This
item makes it good rather than merely correct.

```http
GET /v1/event?after=event_01J…&wait=30
```

The daemon holds the request until an event arrives or the wait elapses, then answers with the existing
response shape. An elapsed wait is a normal empty `200`, never an error and never a timeout — the
client must be able to tell a quiet daemon from an unreachable one. It reuses the cursor, the filters,
the schema and the error envelope. It needs no new transport in the client, no new media type and no
resume semantics.

Keep the maximum `wait` conservative. A browser tab holds one connection for the duration, and any
browser, proxy or NAT idle timeout in the path must be longer than the wait.

It carries **lifecycle events only**. Read the three-kinds table in [polling.md](polling.md). No
mechanism in this product carries live agent output, and none is planned.

### E6 — a stated version compatibility policy

`X-Kanthord-Client` and `/v1/status` exist, and nothing states which version pairs are supported, what an
unsupported client gets, whether a response may gain a field inside `v1`, or whether a client must
tolerate an unknown enum value. The client has taken the tolerant position in
[conventions.md](conventions.md). Confirm or replace it.

This matters more now that the client builds ahead of the daemon. The SDK has no mapping layer by design,
so the compiler is the client's main defence against a shape change — and a compiler says nothing about
the process on the other end of the socket. **A daemon older or newer than the client is the one wire
hazard no amount of client-side typing addresses.** Read the "What the compiler will not catch" section
of [parallel-development.md](parallel-development.md).

The specific question to answer: may a released client talk to a daemon of a different version, and if
so, what is the client allowed to assume? A `mustUpgrade` field on `/v1/status` would let the client say
so plainly instead of guessing.

### E7 — the idempotency key. DECIDED and specified

The owner has decided: an `Idempotency-Key` header, validated by middleware, stored in an in-memory
cache with a configurable TTL defaulting to 5 minutes. Specified in
`kanthord-engine/.agent/plan/epics/010.6-idempotent-post.md`.

The client consequence is in the retry section of [errors.md](errors.md): a keyed `POST` is retryable,
one key per logical operation rather than per attempt, and the same bytes on every attempt.

Four properties of the engine design the client depends on, so raise it if any changes:

- Idempotency is a **policy per operation** in the registry — `none`, `memory` or `durable` — not one
  blanket rule. `plan.import` is `durable` and keeps `importId`.
- A duplicate arriving while the first is in flight **joins** it. There is no new error code, so the
  SDK needs no polling loop.
- A cacheable outcome is declared per operation, never inferred from the status class. A
  `409 lease-held` is not cached, so a client that waits for a lease and retries is not answered from a
  stale record.
- The guarantee is **bounded same-process duplicate suppression**, not exactly-once. The client must
  still read state back after an uncertain failure.

### E8 — a conventional default port

`KANTHORD_HTTP_PORT` has no default, so the client can ship no default base URL.

This is the smallest item here and it is also the least valuable. It helps a desktop-local
developer and it does nothing for a phone, which needs a LAN address the client cannot guess. Fix it
for convenience, not as a solution to configuration. The client still needs the provisioning flow of
[auth.md](auth.md) either way.

## What the engine will not add

Each of these is a route an earlier client plan implied. Each would damage the product. These are
settled, not open: the engine records the same refusal in
`kanthord-engine/docs/proposal/after-the-mvp.md`.

### R1 — a chat resource, or any agent route outside the audit chain

**Decided: the MVP has no conversational surface, in either repository.**

Every execution path in this daemon is attributed and replayable: a plan revision, a node, a lease, a
run, an attempt, an invocation with its pinned model and its blob-addressed prompt, and an event per
transition. A free-form conversation route would be a second product inside the daemon with none of
that.

The invariant, which is narrower and more defensible than "no prompt route":

> Refuse any operation that invokes an agent outside a project, a run, a node, an attempt and a
> durable audit record.

That leaves room for a later human-authored operation that turns a request into an auditable graph node,
or that drafts a plan the human then imports explicitly. Neither is chat, and neither is in scope now.

Client consequences, and they are enforceable by review: no chat page, no prompt box, no message list,
no `AgentEvent` type, no `send` method on any resource, and no feature or branch named `agent-chat`.

### R2 — a prompt-carrying streaming endpoint

Refuse **prompt-carrying streaming**. The progress channel is a filtered `GET` over the event log, and
it carries lifecycle events, never agent output. Read [polling.md](polling.md).

The client has withdrawn SSE entirely in favour of long polling, so this refusal costs nothing.

### R3 — a route that writes node state

The client's bloc-per-screen habit invites `PATCH /v1/node/:id`. Every transition is already an
action route, precisely so a client-written state field cannot exist. Read the last sections of
[conventions.md](conventions.md).

### R4 — a token in a query parameter

It would make browser `EventSource` work. It puts a permanent, unrevocable credential in a URL, a
proxy log, a server log and a browser history. Read [connectivity.md](connectivity.md) for the
gateway that solves this properly.
