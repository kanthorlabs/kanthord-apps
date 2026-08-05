# Errors

Every error is one shape, on every route, at every status.

```json
{
  "error": {
    "code": "stale-revision",
    "message": "the plan was exported from revision_01JQ8Z7G3H, and the project is at revision_01JQ8ZR9S1",
    "details": {
      "expected": "revision_01JQ8Z7G3H",
      "actual": "revision_01JQ8ZR9S1"
    }
  }
}
```

**Branch on `code`. Never parse `message`.** `message` is a human string and it is not contract. A
block reason, a publish rejection class and a repository state all travel in `details`, not in the
message.

`details` is absent on some codes and present on others. Treat it as a nullable
`Map<String, dynamic>`. Do not model it as a typed field, because its shape differs per code.

## The 21 codes

| Status | Code                       | Meaning                                                                      |
| ------ | -------------------------- | ---------------------------------------------------------------------------- |
| 400    | `invalid-request`          | The body failed schema validation                                            |
| 401    | `unauthenticated`          | No bearer token, or a wrong one                                              |
| 403    | `origin-forbidden`         | The request carried an `Origin` header                                       |
| 403    | `host-forbidden`           | The `Host` header is outside the allow list                                  |
| 404    | `not-found`                | No such resource, or a `post-mvp` path                                       |
| 409    | `stale-revision`           | A precondition token no longer matches, or the candidate was invalidated     |
| 409    | `illegal-transition`       | The node state does not allow the command                                    |
| 409    | `binding-in-use`           | A removal is refused. `details` lists what blocks it                         |
| 409    | `needs-reconcile`          | The repository diverged. `details` holds both object ids                     |
| 409    | `acknowledgement-required` | The projection is `partial` and the request omitted the acknowledgement      |
| 409    | `lease-held`               | A live lease refuses the operation                                           |
| 409    | `idempotency-mismatch`     | An `importId` came back with a different document                            |
| 409    | `choices-stale`            | Topology moved since `plan.validate`, so the required choice set changed     |
| 409    | `choices-changed`          | A selected outcome is no longer legal against current runtime state          |
| 409    | `host-key-mismatch`        | The host presented no key matching the confirmed fingerprint                 |
| 422    | `plan-invalid`             | The plan failed validation. `details` lists every finding                    |
| 422    | `choices-invalid`          | The choice set builds an invalid graph. `details` names the nodes            |
| 422    | `identity-kind-mismatch`   | One ULID payload appeared under two kind prefixes                            |
| 422    | `credential-rejected`      | The forge refused the credential. `details` holds its response               |
| 500    | `internal-error`           | The daemon failed unexpectedly. The message is the constant `internal error` |
| 501    | `not-implemented`          | The route ships in a later phase, and it wrote no state                      |

The list is closed at this commit. Tolerate an unknown code: map it to the response-error exception
and keep the raw code on the exception. Never throw a decode error because a code is unfamiliar.

## The mapping to `ApiException`

`api_exception.dart` is a `sealed class`. This is the mapping, and it is the whole of it.

| Subclass                     | Triggered by                                                         |
| ---------------------------- | -------------------------------------------------------------------- |
| `ApiNoNetworkException`      | A connection failure, DNS failure, or a browser CORS failure         |
| `ApiTimeoutException`        | A connect, receive or send timeout                                   |
| `ApiUnauthorizedException`   | 401 `unauthenticated`                                                |
| `ApiNotImplementedException` | 501 `not-implemented`                                                |
| `ApiResponseException`       | Every other envelope. Carries `status`, `code`, `message`, `details` |
| `ApiDecodeException`         | The body is not the envelope, or a model fails to decode             |
| `ApiCancelledException`      | The caller cancelled                                                 |

Two subclasses beyond the `HANDOFF.md` list, and each earns its place.

`ApiNotImplementedException` is separate because 51 of 53 operations answer it today. It is not an
error the user caused and not a failure the user can fix. A screen must render "this daemon does not
do this yet" and not a red error banner. Collapsing it into the response error would make every
unfinished screen look broken.

`ApiUnauthorizedException` stays separate but changes meaning. Read [auth.md](auth.md): there is no
refresh, so a 401 is terminal.

`403 origin-forbidden` and `403 host-forbidden` map to `ApiResponseException`. Both are
configuration faults, never user faults. Detect them and show the operator message from
[connectivity.md](connectivity.md), because a generic "forbidden" sends a developer hunting for a
permission that does not exist.

## Codes that must never be retried

- `host-key-mismatch` — the host may have rotated its key, or something may be answering in its
  place. Show the human both fingerprints and stop. A retry loop on this code is a security defect.
- `idempotency-mismatch` — a client defect. Retrying repeats it.
- `unauthenticated` — no refresh exists, so a retry sends the same wrong token.
- `not-implemented` — the daemon will never answer differently at this version.

## Codes that mean "re-read, then retry"

`stale-revision`, `choices-stale`, `choices-changed` and `needs-reconcile` each carry the current
value in `details`. The client re-reads and resubmits. This is a **user-visible** retry, not an
interceptor retry: the human must see what changed before the client resubmits a plan. Never retry
these automatically.

## The retry interceptor

`HANDOFF.md` step 4a specifies retrying `GET`, `HEAD`, `PUT` and `DELETE`. That rule is replaced.

- **`HEAD` is not in the contract.** The engine declares four methods only: `GET`, `POST`, `PUT`,
  `DELETE`. A `HEAD` retry rule is dead code.
- **A method is not a proof of replay safety.** Repeating a `PUT` may append another event or trigger
  external work, whatever HTTP semantics say. No engine document states replay safety per operation.
- **A keyed `POST` is retryable.** The engine gains an idempotency-key middleware. See below.

The rule:

| Method                           | Retry                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `GET`                            | Always                                                                               |
| `POST` with an `Idempotency-Key` | Yes                                                                                  |
| `POST` with no key               | Never                                                                                |
| `PUT`, `DELETE`                  | Never automatically. Each is a human action behind a button, so the human retries it |

Retry on a connection error, on a timeout, and on 502, 503, 504. Never on another 4xx and never on a 501. Three attempts total, backoff 200 ms then 800 ms with jitter. Stop immediately on cancel.

**Inject the jitter source.** A test cannot assert a backoff schedule against a real `Random`. Take a
`Random` in the constructor and pass a seeded one in the test. `docs/testing.md` determinism applies
to the SDK.

## The idempotency key

The engine gains a middleware that suppresses a duplicate `POST`. From
`kanthord-engine/.agent/plan/epics/010.6-idempotent-post.md`.

Send `Idempotency-Key: <value>` on a `POST`. The daemon records the key with a fingerprint of the
method, the path, the query string and the raw body bytes, runs the command once, and replays the
stored answer to a duplicate. A duplicate that arrives while the first is still running joins it and
receives the same answer. Retention is an in-memory cache with a configurable TTL, default 5 minutes.

Three client rules, and the first is the one that makes the mechanism work at all.

- **Mint one key per logical operation, not per HTTP attempt.** A new key on each retry makes the
  mechanism a no-op. The key belongs to the intent: mint it where the user presses the button, pass it
  down, and reuse it for every attempt of that intent. A ULID is a fine key.
- **Send the same bytes on a retry.** The fingerprint covers the raw body. Serialize once, keep the
  bytes, resend them. A re-serialization that reorders a JSON object is `409 idempotency-mismatch`.
- **Treat `409 idempotency-mismatch` as a client defect.** It means one key carried two different
  requests. Do not retry it and do not mint a new key to get past it. Log it and fail.

### What it does not guarantee

**It is bounded, same-process duplicate suppression. It is not exactly-once execution.** A daemon
restart empties the cache. A command that reaches a git forge can succeed remotely and fail locally. A
`POST` that runs longer than the retention window outlives its own record. So a keyed retry that fails
still leaves the client uncertain, and the answer is to read state back — `node.list`,
`plan.revisions`, `repository.show` — never to assume.

Never render "safe to retry" in the UI on the strength of a key.

### `plan.import` is different, and better

`plan.import` carries `importId` in its **body**, and its idempotency is durable: it lives in the
database, inside the import transaction, it never expires, and its fingerprint normalizes and sorts
the documents so a reordered array is still a retry. It exists because the accepted document lives
only in that response, so a crash after the commit is exactly the case it covers — and an in-memory
cache is empty after the restart that follows a crash.

If the SDK sends an `Idempotency-Key` on `plan.import`, **it must equal `importId`**. A different value
is `400 invalid-request`. The simplest correct implementation mints one ULID per import intent and uses
it for both.
