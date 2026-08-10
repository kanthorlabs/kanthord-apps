# Progress: long polling

The client watches work by polling the event log with a cursor. **The SSE design is withdrawn.** Build
no framing parser, no `SseClientType`, no conditional import, no browser `fetch` streaming reader, no
`AbortController`, no `EventSource`, and no `AgentEvent`.

## Why long polling, not SSE

Four reasons, and the first is decisive for a six-target client.

1. **A browser cannot use `EventSource` against this API.** `EventSource` cannot set an
   `Authorization` header, and the daemon requires a bearer token on every route and uses no cookie.
   SSE on web would have needed a custom `fetch` streaming reader that long polling does not, so SSE
   costs a second transport on one platform and long polling costs none.
2. **There is no stream to consume.** `GET /v1/event/stream` is `post-mvp` and answers `404`. The
   daemon-side wait the engine will add is a filtered `GET` on `event.list`, not a stream.
3. **One code path on six platforms.** Long polling runs on the ordinary Dio adapter everywhere.
4. **The connection is not stable.** The daemon runs on a host the client reaches over a link that
   drops. SSE holds one long-lived connection and rebuilds its whole delivery guarantee on
   reconnection; long polling treats every poll as a fresh request and carries the cursor, so a drop
   costs one retry and never a lost event.

Long polling is not free on web. Read "Web behaviour" below before scoping a screen around it.

## What the client can show, and what it cannot

Three different things get called streaming. Only the first two exist in this product.

| Kind                     | What it carries                                                        | Engine support                                                   |
| ------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Lifecycle notification   | A node changed state. A run started. An attempt was rejected           | `event.list`                                                     |
| Durable execution detail | A completed tool trace, diff, check log or reviewer reason is readable | `node.attempts`, `attempt.show`, `node.checks`, plus `blob.show` |
| Live agent output        | Tokens, partial reasoning, tool calls while an invocation runs         | **Nothing. Not designed, not planned**                           |

The event log records durable domain transitions, and every large payload is a blob written when the
work finished. So a progress view appends "task_01J… moved to `implementing`" and then makes a diff
openable. It never types out an answer. **Never describe lifecycle events as live agent output**, in
the UI or in a commit message.

## `lib/api/polling/`

One `EventPoller`. It knows nothing about Flutter and nothing about a bloc. It takes an
`EventResource`, a starting cursor, a configuration, a clock and a `Random`.

### The delivery API is an acknowledged handler, not a `Stream`

An earlier draft said the poller exposes `Stream<List<KanthordEvent>>`. **That is withdrawn.** Two
rules below — advance the cursor only after a page is accepted, and stop requesting while a page is
undelivered — need the producer to know that the consumer finished. A `StreamController` never tells
it that: `add` returns `void` and the controller buffers. The `Stream` API and those two rules cannot
both hold.

```dart
typedef EventPageHandler = Future<void> Function(List<KanthordEvent> page);
```

The poller takes one handler. A page is **accepted** when the future the handler returns completes.
The cursor advances then, and not before. The poller issues no request while a handler future is
outstanding, so backpressure is a property of the loop rather than a policy. A handler that throws is
a consumer defect: the poller stops, reports it, and never advances the cursor past the failed page.

Delivery is therefore at-least-once. A consumer that crashes between the page and the acknowledgement
sees that page again, so a handler that mutates must tolerate a repeat.

### The status output is separate from delivery

Four failure classes, a quiet daemon and a cancellation are six states, and a page type carries none
of them. The poller exposes `Stream<PollerStatus>`, a sealed type: `polling`, `quiet`, `retrying` with
the next delay, `terminal` with the reason, and `cancelled`. This stream broadcasts state and carries
no delivery guarantee, so a plain controller is correct for it.

`scripts/arch-check.sh` bans `Stream<` under `lib/api/resources/` only, which is what `CLAUDE.md`
states. `lib/api/polling/` is outside that rule.

### The request

`GET /v1/event?after=<lastEventId>&limit=<n>`, plus the domain filters the caller supplies:
`subjectKind`, `subject`, `type`, `actorKind`, `actor`.

The cursor rules are in the paging section of [conventions.md](conventions.md) and they bind this
poller:

- `limit` defaults to **100** and caps at **500**. `limit=501` is `400 invalid-request`, which is a
  terminal failure for the poller, not a retry.
- `after` is **omitted** on the first request. Never send `after=`, because the schema refuses an
  empty string.
- `after` is an **exclusive lower bound** — `id > after` — and not a reference to a row. An id absent
  from the log is legal, so an empty page is "caught up" and never "bad cursor". Read the `after`
  section of [conventions.md](conventions.md), including the two rules that stop a stale cursor from
  stalling the poller in silence.
- The query object is strict. The poller sends the declared keys and no others.
- A page holding fewer rows than the effective limit means caught up. **The poller's own "full page"
  rule uses the effective limit**, so it must know the number it sent. Send `limit` explicitly rather
  than relying on the default, or a page of 100 is indistinguishable from a page that filled.

The response is `{"events":[...]}`, an object with one array. Each event carries `id`, `type`,
`subjectKind`, `subjectId`, `actorKind`, `actorId`, `payload` and `createdAt`. Note the asymmetry:
the **filters** are `subject` and `actor`, and the **fields** are `subjectId` and `actorId`.
`createdAt` is an integer and `payload` is arbitrary JSON.

When the engine adds the daemon-side wait, the poller adds `&wait=<seconds>` and nothing else changes.
See `blockers.md` E5.

### The delivery protocol

These rules are the contract of the poller. Each one is a defect if it is missing.

- **Advance the cursor only after a page is accepted for delivery.** A page is accepted when the
  handler future completes. Advancing on receipt loses a page when the consumer is gone.
- **Drain a full page immediately.** A page holding `limit` events means more exist. Request the next
  page at once and do not sleep. Sleeping on a full page makes the client fall permanently behind a
  busy run.
- **Sleep only on a short or empty page.** That is the only state that means "caught up".
- **Emit in returned order, and never assert a contiguous sequence.** A ULID is not dense, so two
  adjacent ids do not prove nothing is between them. Never compute a count from two ids.
- **Deliver nothing after cancellation.** A response can win the race against a `CancelToken`, so
  check the cancelled flag before every call to the handler, not only before every request.
- **Take a `CancelToken` per in-flight request** and cancel it when the caller stops the poller or the
  bloc closes.
- **Take the clock and the `Random` in the constructor.** A test cannot assert an interval or a backoff
  against a real timer.

### Failure classification

Do not treat every failure as "poll again". Four classes, four behaviours.

| Failure                                                                                | Behaviour                                                                                                                |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `401 unauthenticated`, `403 origin-forbidden`, `403 host-forbidden`                    | **Terminal.** Stop the poller and surface the state. Retrying sends the same wrong token or the same wrong configuration |
| A deterministic `4xx` — `400 invalid-request` from a bad cursor or a `limit` above 500 | **Terminal.** It is a protocol defect and it repeats                                                                     |
| `429`, if it ever appears                                                              | Honour `Retry-After`                                                                                                     |
| A connection error, a timeout, `502`, `503`, `504`                                     | Capped exponential backoff with jitter. Never hot-loop                                                                   |

**A client-side receive timeout is a transport failure, not an empty page.** When the daemon-side wait
lands, a wait that elapses is a normal empty `200` from the server. A Dio receive timeout is a
different event, and it means the network or the daemon is gone. Treating one as the other hides a real
outage. Set the receive timeout for this one operation above `wait` plus a margin, or every long poll
fails.

### Backpressure and restart

- **Backpressure.** The poller issues no request while a handler future is outstanding. A plan graph
  is small and dropping a lifecycle event makes a progress view wrong, so the loop waits rather than
  buffering. This follows from the acknowledged handler and needs no separate policy.
- **Restart. DECIDED: resume from a persisted cursor, and drain history when there is none.** The
  poller takes `after` as an argument and never invents one. The app persists the last acknowledged id
  and passes it back.

  An earlier draft offered "start from now" as the second choice. **It is not implementable.**
  `GET /v1/event` with no `after` returns the first page from the beginning, and no operation returns
  the current tail. There is no way to ask this daemon for "the newest id and nothing before it", so
  the option described a route that does not exist.

  So a null `after` means one thing: page the log from the beginning through the same handler, at the
  same `limit`, then continue polling. History and live delivery are one loop and one code path. A
  caller that does not want the history persists a cursor.

  The cost is bounded rather than alarming. One request returns at most 500 rows and 100 by default,
  so a first run is a sequence of ordinary pages that the drain rule already handles — the poller
  requests the next page immediately on a full one and sleeps on a short one. There is no separate
  history mode and no unbounded response. Revisit when the engine offers a tail cursor or a time
  filter.

- **A run outlives a poller.** Reconcile with `system.status` and `node.list` when a view opens.
  Progress is a convenience; the node state is the truth.

## Web behaviour

Long polling works on web with the ordinary Dio browser adapter, once the daemon allows the origin.
Read `connectivity.md`. It has four web-specific costs, and none of them is a reason to go back to SSE.

- **A background tab throttles or suspends timers.** A poll loop can stall or become very late while
  the tab is hidden. Detect visibility, stop polling when hidden, and reconcile from `system.status`
  and `node.list` when it returns. Do not assume the loop kept running.
- **A preflight can be paid per request** once the `Access-Control-Max-Age` window expires. The engine
  sets that header for this reason. It is still more requests than a native client makes.
- **A long poll occupies one browser connection** per tab, and the wait must stay below any browser,
  proxy or NAT idle timeout in the path. Keep the daemon-side wait conservative.
- **Two tabs are two independent loops.** Jitter the backoff so they do not synchronize. Cross-tab
  coordination is out of scope for the MVP; if the load ever matters, that is where to look.

## What a bloc does with it

The bloc passes a handler, maps a page to state, and returns the future the poller waits on. It
listens to `PollerStatus` for the failure and quiet states, and it stops the poller in `close()`. It
owns no timer and no cursor rule.

The bloc owns two things the poller cannot: persisting the last acknowledged id, and the platform
lifecycle. A web tab throttles timers when it is hidden, so the bloc stops the poller on hide and
reconciles from `system.status` and `node.list` on return. Every other rule lives in `EventPoller`,
because a rule in a bloc is a rule the next bloc gets wrong.
