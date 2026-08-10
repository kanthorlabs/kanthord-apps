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
`EventResource`, a starting cursor and a configuration, and it exposes a `Stream<List<KanthordEvent>>`.

### The request

`GET /v1/event?after=<lastEventId>&limit=<n>`, plus the domain filters the caller supplies:
`subjectKind`, `subject`, `type`, `actorKind`, `actor`.

When the engine adds the daemon-side wait, the poller adds `&wait=<seconds>` and nothing else changes.
See `blockers.md` E5.

### The delivery protocol

These rules are the contract of the poller. Each one is a defect if it is missing.

- **Advance the cursor only after a page is accepted for delivery.** Advancing on receipt loses a page
  when the consumer is gone. Document the choice in the class.
- **Drain a full page immediately.** A page holding `limit` events means more exist. Request the next
  page at once and do not sleep. Sleeping on a full page makes the client fall permanently behind a
  busy run.
- **Sleep only on a short or empty page.** That is the only state that means "caught up".
- **Emit in returned order, and never assert a contiguous sequence.** A ULID is not dense, so two
  adjacent ids do not prove nothing is between them. Never compute a count from two ids.
- **Emit nothing after the subscription cancels.** A response can win the race against a
  `CancelToken`, so check the cancelled flag before every emit, not only before every request.
- **Take a `CancelToken` per in-flight request** and cancel it when the subscription cancels or the
  bloc closes.
- **Take the clock and the `Random` in the constructor.** A test cannot assert an interval or a backoff
  against a real timer.

### Failure classification

Do not treat every failure as "poll again". Four classes, four behaviours.

| Failure                                                             | Behaviour                                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `401 unauthenticated`, `403 origin-forbidden`, `403 host-forbidden` | **Terminal.** Stop the poller and surface the state. Retrying sends the same wrong token or the same wrong configuration |
| A deterministic `4xx` — an invalid cursor, `400 invalid-request`    | **Terminal.** It is a protocol defect and it repeats                                                                     |
| `429`, if it ever appears                                           | Honour `Retry-After`                                                                                                     |
| A connection error, a timeout, `502`, `503`, `504`                  | Capped exponential backoff with jitter. Never hot-loop                                                                   |

**A client-side receive timeout is a transport failure, not an empty page.** When the daemon-side wait
lands, a wait that elapses is a normal empty `200` from the server. A Dio receive timeout is a
different event, and it means the network or the daemon is gone. Treating one as the other hides a real
outage. Set the receive timeout for this one operation above `wait` plus a margin, or every long poll
fails.

### Backpressure and restart

- **Backpressure.** Decide what happens when the consumer is slower than the pages arrive. The
  recommendation is to stop requesting while a page is undelivered, because a plan graph is small and
  dropping a lifecycle event makes a progress view wrong.
- **Restart.** The cursor is in memory. A tab reload or an app restart therefore needs an explicit
  starting position, and there are only two honest choices: replay from a persisted cursor, or start
  from now and read the history separately with a plain `event.list` call. Pick one and write it in the
  class. Do not leave it implicit.
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

The bloc subscribes, maps a page to state, and closes the subscription in `close()`. It owns no timer
and no cursor. Every rule above lives in `EventPoller`, because a rule in a bloc is a rule the next
bloc gets wrong.
