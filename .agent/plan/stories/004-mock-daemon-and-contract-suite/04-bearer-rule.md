# Story 04 — the bearer rule

Epic: `.agent/plan/epics/004-mock-daemon-and-contract-suite.md`
Depends on: Story 02 (`writeError`), Story 03 (`matchRoute`).

**Both Tasks are the test-engineer lane.** This Story closes
`test/mock_daemon/contract_enforcement_test.dart` and delivers `PASS 004-G2-ENFORCEMENT`.

## Change

- `test/mock_daemon/mock_daemon.dart` — insert the token check as the **first** statement of
  `_handle`, before the `matchRoute` call:

  ```dart
    Future<void> _handle(HttpRequest request) async {
      if (!_authorized(request)) {
        await writeError(request.response, 'unauthenticated', 'no bearer token, or a wrong one');
        return;
      }
      final match = matchRoute(request.method, request.uri.path);
      ...
    }
  ```

- `test/mock_daemon/mock_daemon.dart` — add the private predicate immediately after `_handle`:

  ```dart
    bool _authorized(HttpRequest request) {
      final header = request.headers.value(HttpHeaders.authorizationHeader);
      return header == 'Bearer $kMockDaemonToken';
    }
  ```

## Constraints

- The check runs **before** routing and is the first stage of `_handle`. It is not the first stage
  of the request: `_serve` drains and records the body first, because an undrained body blocks the
  connection. So the daemon reads a whole unauthenticated body before it answers `401`. Say it that
  way. The real daemon's ordering here is not specified by any document in `docs/api/`, and nothing
  in this EPIC depends on it.
- A registered path and an unregistered path must answer identically to a caller with no token, or
  the mock leaks the route table to an unauthenticated client and teaches the client that a `404`
  means "no such route".
- `system.health` is not exempt. `docs/api/contract/features/system.yaml:5-6` applies
  `security: bearerAuth` to the whole document, so every route requires the token.
- The comparison is exact, including the `Bearer ` prefix and the case of it. A wrong token, an
  empty token and a missing header all answer the same `401 unauthenticated`.
- No token arrives in a query parameter, ever. `docs/api/blockers.md` R4 refuses it, so the mock
  reads the header alone and a `?token=` query key is simply an unknown query key.
- The `401` body is the envelope, written by `writeError`. Never a bare status.

## Tasks

### Task 004.1 — the bearer test

**Input:** `test/mock_daemon/contract_enforcement_test.dart`

**Action — RED:** extend the file. `probe` takes a nullable `token`, so `token: null` sends no
header, and `rawAuthorization` sets the header value verbatim. Every test registers
`addTearDown(daemon.stop)`.

Group `MockDaemon`, nested group `the bearer rule`:

- `'should answer unauthenticated when the request carries no token'` — `GET`
  `'${daemon.baseUrl}/v1/health'` with `token: null`; assert the status is `401` and the error
  `code` is `'unauthenticated'`.
- `'should answer unauthenticated when the token is wrong'` — the same path with
  `token: 'not-the-token'`; assert `401`.
- `'should answer unauthenticated when the token is empty'` — the same path with `token: ''`;
  assert `401`.
- `'should answer unauthenticated when the scheme is missing'` — `rawAuthorization:
kMockDaemonToken`, with no `Bearer ` prefix; assert `401`.
- `'should answer unauthenticated before routing when the path is unregistered'` — `GET`
  `'/v1/nope'` with `token: null`; assert the status is `401`, **not** `404`. This is the assertion
  that proves the check precedes routing.
- `'should answer unauthenticated before routing when the path is stubbed'` — `GET` `'/v1/worker'`
  with `token: null`; assert the status is `401`, not `501`.
- `'should answer the envelope shape when the token is refused'` — assert the `401` body has an
  `error` object carrying a `code` and a non-empty `message`.
- `'should answer the fixture when the token is correct'` — `GET` `'/v1/health'` with the default
  token; assert the status is `200`. This proves the rule is a gate and not a wall.

**Action — GREEN:** the same role applies the two `mock_daemon.dart` edits, then re-runs the file.

## Verify

- `make test-one T=test/mock_daemon/contract_enforcement_test.dart` exits 0.
- `make test-one T=test/mock_daemon/mock_daemon_test.dart` exits 0. The Story 01 tests already send
  the default token through their `HttpClient` calls; add
  `request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $kMockDaemonToken')` to the ones
  that do not, and change nothing else. The tear-down test and the two port tests are unaffected.
- `make verify` exits 0.
- Proof: `PASS 004-G2-ENFORCEMENT`.
