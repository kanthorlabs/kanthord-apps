# Story 06 — `lib/api/README.md`

Epic: `.agent/plan/epics/001.1-candidate-client-and-daemon-pinning.md`
Depends on: Story 05 (`withCandidate` and `adapterFactory` exist and are described here).

## Change

- New `lib/api/README.md`, with exactly this content:

  ```markdown
  # The kanthord SDK

  One typed client over the daemon REST API. `lib/api/` imports nothing from `lib/features/`,
  `lib/app/` or `lib/libraries/`, and it imports no `package:flutter/`.

  ## Resources

  | Group    | Class            | Method     | Endpoint            |
  | -------- | ---------------- | ---------- | ------------------- |
  | `system` | `SystemResource` | `health()` | `GET /v1/health`    |
  | `system` | `SystemResource` | `db()`     | `GET /v1/db/status` |

  EPIC 006 adds the remaining schema-carrying operations. An operation with no schema in the contract
  snapshot carries no model and no method.

  ## One request resolves one daemon

  `BaseUrlInterceptor` calls `BaseUrlProviderType.endpoint()` one time per request. It sets
  `options.baseUrl` and writes the endpoint id into `options.extra[kDaemonIdKey]`. Every later stage
  reads the pinned id and never resolves again, so `AuthInterceptor` calls
  `TokenProviderType.tokenOf(id)` and the base URL and the token always come from the same daemon.

  A request that already carries a `String` at `options.extra[kDaemonIdKey]` is already pinned, and
  `BaseUrlInterceptor` returns without resolving anything. `Dio.fetch` re-runs the whole request
  interceptor chain, which is how a retry re-sends a request, so this guard is what stops a retry
  migrating to a second daemon. Add no code that clears the key before a retry.

  A `null` endpoint is a normal state. It throws `ApiNotConfiguredException` before the request
  leaves, and no daemon answer ever produces that exception.

  ## The candidate contract

  `api.withCandidate(baseUrl:, token:)` returns a second `KanthordApi` over a static endpoint whose
  id is `kCandidateDaemonId` and a static token. It clones nothing. Two rules bind every change:

  - **Every interceptor a candidate needs is added by the `KanthordApi` constructor.** Never add an
    interceptor onto a `Dio` from outside the constructor, or a candidate probes with a different
    stack than the client it came from.
  - **The caller owns the candidate and closes it.** Nothing else holds a reference, and
    `candidate.dio.close(force: true)` cannot disturb the client it came from.

  `KanthordApi` takes `HttpClientAdapter Function()? adapterFactory`. It applies the factory to the
  `Dio` it builds — never to a `Dio` the caller passes, because that adapter belongs to the caller —
  and it passes the factory to every candidate. That is the seam a test uses to reach a candidate a
  feature creates internally.
  ```

## Constraints

- The file holds these four sections and nothing else. Add no transport table, no error table and no
  timeout table — each already lives in `docs/api/`.
- Do not edit `CLAUDE.md`. `scripts/lane-check.sh:44` denies it, and its "does not exist yet" note
  for this README is the human's to remove.
- Run `make format` after writing the file and keep the result. Prettier owns the table padding, and
  `make format-check` is part of `make verify`.

## Tasks

### Task 006.1 — the README

**Input:** `lib/api/README.md`

**Action — GREEN:** write the file exactly as the `## Change` section states, then run
`make format`.

**Action — REFACTOR:** none.

## Verify

- `make format-check` exits 0.
- `make verify` exits 0.
- Proof: no `PASS` line. The EPIC Proof block asserts code, and this Story delivers the two binding
  rules the EPIC requires the README to state.
