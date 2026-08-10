# EPIC 005 — The interceptor stack

Status: **ready**.

Retry, idempotency and logging. Each rule comes from `docs/api/errors.md`, and each is tested against
the mock daemon of EPIC 004 on a real socket, not against a mock adapter.

Every rule here is generic. Nothing in this epic names an operation, because no operation model
exists until EPIC 006.

## Goal

- **G1** — `lib/api/interceptors/retry_interceptor.dart` retries a `GET` always and a `POST` that
  carries an `Idempotency-Key`. It retries a keyless `POST`, a `PUT` and a `DELETE` never.
- **G2** — It retries on a connection error, on a timeout, and on `502`, `503` and `504`. It retries
  on no other `4xx`, never on a `501`, and never on `host-key-mismatch`, `idempotency-mismatch`,
  `unauthenticated` or `not-implemented`.
- **G3** — Three attempts total. The delay before attempt two is 200 ms and before attempt three is
  800 ms, each with full jitter: `delay = base * random.nextDouble()`. The `Random` and the delay
  function are constructor arguments, so a seeded `Random` gives one exact schedule.
- **G4** — A cancelled request stops at once and is never retried.
- **G5** — `lib/api/interceptors/idempotency_interceptor.dart` attaches the key the call site
  supplies to a `POST`. It mints no key. A retry resends the same key and the same body bytes.
- **G6** — `lib/api/interceptors/logging_interceptor.dart` redacts by a declared field-name list,
  applied to the headers, the query string and the body. The list starts with `authorization` and
  `idempotency-key`. It uses `logger` and never `print`.
- **G7** — `KanthordApi` installs the interceptors in one declared order — auth, idempotency, retry,
  logging — and a test asserts the order.

## Non-goals

- No key minting inside the SDK. The key belongs to the user intent, so the call site mints it and
  passes it down. One key per logical operation, never one per HTTP attempt.
- No operation-specific rule. The `plan.import` rule that an `Idempotency-Key` must equal `importId`
  needs the request model, so EPIC 006 owns it. The credential field names of `provider.register`
  need that model too, so EPIC 006 adds them to the redaction list.
- No user-visible retry. `stale-revision`, `choices-stale`, `choices-changed` and `needs-reconcile`
  are re-read-then-resubmit, and a screen owns each.
- No exactly-once claim. The engine guarantee is bounded same-process duplicate suppression. No code
  and no string says "safe to retry".
- No `HEAD` rule. The contract declares four methods and `HEAD` is not one.
- No `429` handling. `Retry-After` belongs to the poller. EPIC 007.
- No structured log sink and no log level configuration beyond the `logger` default.

## Verification gate

Gates: `make verify`

Proof:

```bash
make test-one T=test/api/interceptors/retry_rule_test.dart \
  && echo "PASS 005-G1-METHOD-RULE" \
  && make test-one T=test/api/interceptors/retry_classification_test.dart \
  && echo "PASS 005-G2-CLASSIFICATION" \
  && make test-one T=test/api/interceptors/retry_backoff_test.dart \
  && echo "PASS 005-G3-BACKOFF" \
  && make test-one T=test/api/interceptors/retry_cancel_test.dart \
  && echo "PASS 005-G4-CANCEL" \
  && make test-one T=test/api/interceptors/idempotency_interceptor_test.dart \
  && echo "PASS 005-G5-IDEMPOTENCY" \
  && make test-one T=test/api/interceptors/logging_interceptor_test.dart \
  && echo "PASS 005-G6-REDACTION" \
  && make test-one T=test/api/kanthord_api_test.dart \
  && echo "PASS 005-G7-ORDER" \
  && echo "PASS EPIC-005"
```

Hermetic coverage required beyond the Proof:

- The mock daemon counts requests per operation. A `GET` that fails twice and succeeds on the third
  attempt reaches the daemon three times. A keyless `POST` that fails reaches it one time.
- A keyed `POST` retry carries the identical key value and the identical body bytes on every attempt,
  asserted by the daemon comparing the raw bytes it received.
- A `503` retried three times then still failing surfaces the last `ApiResponseException`, not a
  retry-wrapper error.
- The log output of a full authenticated request holds no token substring and no key substring. The
  test asserts the absence of the literal value it configured.
- A field outside the redaction list is logged. The test adds a secret-looking field and asserts it
  appears, so the list is a declared decision and never a guess.

## Stories

- **The retry rule** — one pure function from the method, the presence of a key, the failure class
  and the error code to a boolean. A function, so a test asserts the whole truth table with no socket.
- **`RetryInterceptor`** — the attempt loop, the injected `Random`, the injected delay function, and
  a cancel check before every attempt. Three attempts total means two retries.
- **The same bytes on a retry** — the body is serialized one time and the bytes are reused. A test
  asserts that a `Map` body whose key order changes between serializations still sends identical
  bytes on every attempt.
- **`IdempotencyInterceptor`** — reads the key from the request options, attaches the header on a
  `POST`, and does nothing on any other method. A `POST` with no key passes through untouched, and
  the retry rule then refuses it.
- **`LoggingInterceptor`** — the redaction list as a constructor argument with a default, applied to
  headers, query and body.
- **The interceptor order** — auth first, so a keyless request never leaves. Logging last, so it
  observes the final request. Retry re-dispatches through `Dio`, so the order is asserted on the
  installed list and on the observed sequence of one retried request.
