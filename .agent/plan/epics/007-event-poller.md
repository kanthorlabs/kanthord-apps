# EPIC 007 — The event poller

Status: **ready**.

Progress is long polling over `event.list` with a cursor. `docs/api/polling.md` holds the protocol,
and every rule in it is a defect if it is missing. Nothing streams from a resource.

Three decisions that once blocked this epic are taken and written into `docs/api/polling.md`. Each
one changes the public API, so none of them may be re-opened at build time.

- **Delivery is an acknowledged handler, not a `Stream`.** The poller takes
  `Future<void> Function(List<KanthordEvent>)`. A page is accepted when that future completes. The
  `Stream` API cannot express "advance only after acceptance", because `add` returns `void`.
- **The restart position is a persisted cursor.** A null cursor drains the log from the beginning
  through the same handler. "Start from now" is withdrawn: `GET /v1/event` with no `after` returns the
  first page from the beginning and no operation returns the current tail. The drain is bounded, since
  `src/http/contract/cursor.ts` caps `limit` at 500 and defaults it to 100.
- **`scripts/arch-check.sh` bans `Stream<` under `lib/api/resources/` only.** The narrowing and its
  self-test are already in the tree, so `lib/api/polling/` may expose a status stream.

## Goal

- **G1** — `lib/api/polling/event_poller.dart` holds one `EventPoller`. It takes an `EventResource`, a
  starting cursor, an `EventPageHandler`, a configuration, a clock and a `Random`. It imports no
  Flutter symbol and knows nothing about a bloc.
- **G2** — The cursor advances when the handler future completes, never on receipt. The poller issues
  no request while a handler future is outstanding, so backpressure is a property of the loop.
- **G3** — It drains a full page at once and sleeps only on a short or empty page.
- **G4** — It delivers in returned order, drops a repeated id, and asserts no contiguous sequence.
- **G5** — It exposes `Stream<PollerStatus>`, a sealed type: `polling`, `quiet`, `retrying` with the
  next delay, `terminal` with the reason, and `cancelled`.
- **G6** — It classifies a failure into the four classes of `docs/api/polling.md`: terminal on `401`,
  `403` and a deterministic `4xx`; `Retry-After` on a `429`; capped exponential backoff with jitter on
  a connection error, a timeout, `502`, `503` and `504`.
- **G7** — It delivers nothing after cancellation, including when a response wins the race against the
  `CancelToken`, and it issues no further request.
- **G8** — A null cursor drains history through the same handler at the same `limit`, then continues
  polling. It is one loop and one code path.
- **G9** — The poller sends `limit` explicitly on every request, inside `1..500`. It never relies on
  the server default, because the drain rule compares the page size against the limit it sent. It
  omits `after` on the first request and never sends an empty one.
- **G10** — The receive timeout for this one operation exceeds the configured daemon wait plus a
  margin.

## Non-goals

- No framing parser, no `SseClientType`, no conditional import, no browser `fetch` reader, no
  `AbortController`, no `EventSource`, no `AgentEvent`.
- No `wait` parameter sent. The request shape admits it and the poller never sends it, because
  `docs/api/blockers.md` E5 is engine work.
- No live agent output. The poller carries lifecycle events. No UI string and no commit message calls
  it agent output.
- No visibility detection and no tab lifecycle. Those need Flutter, and the poller imports none. The
  bloc that owns the handler handles them.
- No cursor persistence store. This epic takes the starting cursor as an argument. The bloc persists
  the last **accepted** id and scopes it to the base URL, in the feature that needs one. A cursor from
  another daemon is a meaningless bound in this one, and it stalls the poller silently. Read the
  `after` section of `docs/api/conventions.md`.
- No exactly-once delivery. A consumer that dies between the page and the acknowledgement sees that
  page again, and a handler that mutates must tolerate a repeat.
- No cursor validation and no invalid-cursor state. `after` is an exclusive lower bound — `id > after`
  — so an id absent from the log is legal and never an error. The poller treats an empty page as
  caught up, whatever the cursor was.
- No cursor minting. The poller receives a cursor and echoes ids the daemon delivered. It derives one
  from no clock and no ULID it built.

## Verification gate

Gates: `make verify`

Proof:

```bash
make test-one T=test/api/polling/event_poller_ack_test.dart \
  && echo "PASS 007-G2-ACK" \
  && make test-one T=test/api/polling/event_poller_drain_test.dart \
  && echo "PASS 007-G3-DRAIN" \
  && make test-one T=test/api/polling/event_poller_order_test.dart \
  && echo "PASS 007-G4-ORDER" \
  && make test-one T=test/api/polling/poller_status_test.dart \
  && echo "PASS 007-G5-STATUS" \
  && make test-one T=test/api/polling/event_poller_failure_test.dart \
  && echo "PASS 007-G6-FAILURE" \
  && make test-one T=test/api/polling/event_poller_cancel_test.dart \
  && echo "PASS 007-G7-CANCEL" \
  && make test-one T=test/api/polling/event_poller_history_test.dart \
  && echo "PASS 007-G8-HISTORY" \
  && make test-one T=test/api/polling/event_poller_query_test.dart \
  && echo "PASS 007-G9-QUERY" \
  && make test-one T=test/api/polling/event_poller_timeout_test.dart \
  && echo "PASS 007-G10-TIMEOUT" \
  && make arch-check \
  && echo "PASS 007-G1-BOUNDARY" \
  && echo "PASS EPIC-007"
```

Hermetic coverage required beyond the Proof:

- No test sleeps on a real clock. The clock and the `Random` are injected, and every interval
  assertion is a call count or an injected instant.
- A handler future held open blocks the next request. The test completes it and asserts the request
  count moves from one to two.
- A handler that throws stops the poller, reports `terminal`, and leaves the cursor at the page
  before the failed one.
- A page of events then an empty page: the cursor advances once per accepted page and then holds.
- A restart with a stored cursor resumes after the last accepted event, never before it.
- An empty `200` is a quiet daemon: it is not an error and it does not reset the cursor.
- A receive timeout is a transport failure and never an empty page. The two are told apart by their
  `PollerStatus`, not by a message.
- A dropped connection mid-poll backs off, retries, and delivers no duplicate event. The mock daemon
  `truncated` scenario of EPIC 004 produces it.
- Five states are distinct: polling, quiet, retrying, terminal and cancelled.

## Stories

- **`PollerStatus`** — the sealed status type and its transitions. It comes first, because every
  later test asserts on it.
- **`EventPageHandler` and the poll loop** — request, classify, deliver, await the acknowledgement,
  decide to sleep. One state machine, and no branch that both sleeps and requests.
- **Cursor advancement and backpressure** — both follow from the acknowledgement, so they are one
  story. The class documents the at-least-once consequence.
- **The history drain** — a null cursor pages from the beginning through the same handler, then
  continues. A test asserts one code path and no second request shape.
- **Failure classification** — one pure function from a failure to a class, tested as a truth table,
  and one behaviour per class in the loop.
- **The query** — `limit` sent explicitly and validated against `1..500` before the request, `after`
  omitted rather than empty on the first call, and no undeclared key. A `400 invalid-request` is
  terminal, never a retry.
- **The cursor is a bound, not a reference** — a test drives the poller from an `after` that names no
  row and asserts it pages normally, and from an `after` above every id and asserts a quiet daemon
  rather than an error. The poller never inspects the cursor it was given.
- **The receive timeout** — this operation uses its own value from `ApiConfig`. A test asserts it
  exceeds the configured wait plus the margin, so a future daemon wait cannot turn every long poll
  into a timeout.
- **Cancellation** — a `CancelToken` per in-flight request, cancelled when the caller stops the
  poller, plus a cancelled check before every handler call.
