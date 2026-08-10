# Story 04 — The web-opaque failure message

Epic: `.agent/plan/epics/001-transport-foundation.md`
Depends on: Story 03 (`ApiException.fromDio` exists with the `isWeb` argument).

## Change

- New `lib/api/api_platform.dart`:

  ```dart
  const bool kApiIsWeb = bool.fromEnvironment('dart.library.js_interop');
  ```

- `lib/api/api_exception.dart`, the no-network branch of `ApiException.fromDio` (rule 4 of Story 03)
  — replace the single message with the two-message branch on the `isWeb` argument, where
  `authority = error.requestOptions.uri.authority`:

  - `isWeb == false`:

    ```
    no answer from the daemon at $authority.
    ```

  - `isWeb == true`:

    ```
    no answer from the daemon at $authority. A browser cannot tell these four causes apart: the daemon is down, the origin is rejected, the host is rejected, or DNS failed. Check KANTHORD_HTTP_ALLOWED_ORIGINS and KANTHORD_HTTP_ALLOWED_HOSTS on the daemon.
    ```

  Both strings are one line and are verbatim.

## Constraints

- The collapse applies to `ApiNoNetworkException` alone. A `401` stays `ApiUnauthorizedException` and
  a `403` stays `ApiResponseException` on every platform, with the messages Story 03 pins.
- `isWeb` stays a required argument. `lib/api/` imports no `package:flutter/foundation.dart`, so
  `kIsWeb` is unavailable, and `dart:io` breaks the web build. `bool.fromEnvironment('dart.library.js_interop')`
  is a compile-time constant that needs no import.
- Do not add a runtime platform switch anywhere else in `lib/api/`.

## Tasks

### Task 004.1 — the two-message test

**Input:** `test/api/api_exception_test.dart`

**Action — RED:** add a nested group `fromDio web` to the existing `ApiException` group, with these
tests. Each builds a `DioException` of type `connectionError` with
`requestOptions: RequestOptions(path: '/v1/health', baseUrl: 'http://127.0.0.1:31415')`.

- `'should name only the daemon when isWeb is false'` — assert the message equals
  `'no answer from the daemon at 127.0.0.1:31415.'`.
- `'should name the four causes and the two config keys when isWeb is true'` — assert the message
  contains `'the daemon is down'`, `'the origin is rejected'`, `'the host is rejected'`,
  `'DNS failed'`, `'KANTHORD_HTTP_ALLOWED_ORIGINS'` and `'KANTHORD_HTTP_ALLOWED_HOSTS'`.
- `'should keep the unauthorized subclass when isWeb is true'` — a `401` `unauthenticated` envelope
  with `isWeb: true`; assert `isA<ApiUnauthorizedException>()`.
- `'should keep the response subclass when isWeb is true'` — a `403` `host-forbidden` envelope with
  `isWeb: true`; assert `isA<ApiResponseException>()` and the message names
  `'KANTHORD_HTTP_ALLOWED_HOSTS'`.

Both messages are asserted in one test file with no platform switch, because `isWeb` is an argument.

**Action — GREEN:** the software-engineer's Task 004.2 creates the seam.

### Task 004.2 — the platform constant and the message branch

**Input:** `lib/api/api_platform.dart`, `lib/api/api_exception.dart`

**Action — GREEN:** write `lib/api/api_platform.dart` and apply the two-message branch exactly as the
`## Change` section states.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/api/api_exception_test.dart` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: `PASS 001-G3-ERRORS`, together with Story 03.
- `NEEDS-HUMAN:` **deferred to EPIC 003.** No gate in EPIC 001 proves that
  `bool.fromEnvironment('dart.library.js_interop')` resolves `true` on the web build: `make verify`
  is headless, and a `make dev` run shows `KDGalleryPage`, which reaches no SDK code. The tests here
  prove both messages through the `isWeb` argument, and the constant's value on web is proven by the
  first feature that calls the daemon from Chrome. State the gap in the ready marker rather than
  claiming a browser check.
