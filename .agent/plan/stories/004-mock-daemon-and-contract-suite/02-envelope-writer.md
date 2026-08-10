# Story 02 — the envelope writer

Epic: `.agent/plan/epics/004-mock-daemon-and-contract-suite.md`
Depends on: Story 01.

**Both Tasks are the test-engineer lane.**

This Story is first of the three that build `test/mock_daemon/contract_enforcement_test.dart`. It
comes before routing and before the bearer rule, because both write their errors through the
function this Story creates.

## Change

- New `test/mock_daemon/error_envelope.dart`:

  ```dart
  import 'dart:convert';
  import 'dart:io';

  const Map<String, int> kErrorStatus = <String, int>{
    'invalid-request': 400,
    'unauthenticated': 401,
    'origin-forbidden': 403,
    'host-forbidden': 403,
    'not-found': 404,
    'stale-revision': 409,
    'illegal-transition': 409,
    'binding-in-use': 409,
    'needs-reconcile': 409,
    'acknowledgement-required': 409,
    'lease-held': 409,
    'idempotency-mismatch': 409,
    'choices-stale': 409,
    'choices-changed': 409,
    'host-key-mismatch': 409,
    'plan-invalid': 422,
    'choices-invalid': 422,
    'identity-kind-mismatch': 422,
    'credential-rejected': 422,
    'internal-error': 500,
    'not-implemented': 501,
    'service-unavailable': 503,
  };

  int errorStatus(String code) {
    final status = kErrorStatus[code];
    if (status == null) {
      throw ArgumentError.value(code, 'code', 'the code is absent from docs/api/errors.md');
    }
    return status;
  }

  Future<void> writeError(
    HttpResponse response,
    String code,
    String message, {
    Map<String, dynamic>? details,
  }) async {
    final status = errorStatus(code);
    response.statusCode = status;
    response.headers.contentType = ContentType.json;
    response.write(
      jsonEncode(<String, dynamic>{
        'error': <String, dynamic>{
          'code': code,
          'message': message,
          if (details != null) 'details': details,
        },
      }),
    );
    await response.close();
  }

  Future<void> writeJson(HttpResponse response, int status, Object? body) async {
    response.statusCode = status;
    response.headers.contentType = ContentType.json;
    response.write(jsonEncode(body));
    await response.close();
  }
  ```

- `test/mock_daemon/mock_daemon.dart` — add the import `import 'error_envelope.dart';` after the
  `dart:io` import, and replace the whole body of `_handle`:

  ```dart
    Future<void> _handle(HttpRequest request) async {
      request.response.statusCode = HttpStatus.notFound;
      await request.response.close();
    }
  ```

  with:

  ```dart
    Future<void> _handle(HttpRequest request) async {
      await writeError(request.response, 'not-found', 'no route matches the request');
    }
  ```

## Constraints

- `kErrorStatus` holds exactly the 22 rows of the table at `docs/api/errors.md:27-50`. It is not a
  closed union for a decoding client — it is the mock's own status map, and an unknown code is a
  defect in the mock, so `writeError` throws rather than guessing a status.
- `details` is omitted from the body when it is null. `docs/api/errors.md:18-24` says `details` is
  absent on some codes, so an always-present `"details": null` would teach the client a shape the
  daemon never sends.
- No handler writes an error body by hand. Every later Story calls `writeError`.
- `writeJson` is the only success writer. Both set `ContentType.json`.

## Tasks

### Task 002.1 — the envelope test

**Input:** `test/mock_daemon/contract_enforcement_test.dart`

**Action — RED:** create the file. It grows in Story 03 and Story 04, so write the imports for this
Story only: `dart:io`, `package:flutter_test/flutter_test.dart`, `error_envelope.dart`,
`http_probe.dart`, `mock_daemon.dart`.

Drive every request through `probe` from `test/mock_daemon/http_probe.dart`, which Story 01 wrote.
Build no `HttpClient` in this file. Mark every test body with `// Arrange`, `// Act` and
`// Assert`, and use no other comment.

Group `errorStatus`:

- `'should return the mapped status when the code is published'` — assert
  `errorStatus('service-unavailable')` equals `503`.
- `'should throw when the code is absent from the published table'` — assert
  `() => errorStatus('made-up-code')` throws an `ArgumentError`. This proves the guard, which a map
  lookup asserted against null does not.

Group `writeError`:

- `'should carry every code of the published table when the status map is read'` — parse
  `docs/api/errors.md` with `RegExp(r'^\| (\d{3}) +\| `([a-z-]+)` +\|')` over
  `File('docs/api/errors.md').readAsLinesSync()`, build the expected `Map<String, int>`, and assert
  `kErrorStatus` equals it. Assert the length is `22` as well, so a broken parser fails loudly
  instead of asserting an empty map against an empty map.
- `'should answer the mapped status when a code is written'` — start a daemon, `GET`
  `'${daemon.baseUrl}/v1/nope'`, assert the status is `404`.
- `'should answer the envelope shape when a code is written'` — the same request; assert
  `result.body['error']` is a `Map<String, dynamic>` whose `code` is `'not-found'` and whose
  `message` is a non-empty `String`.
- `'should omit details when no details are given'` — the same request; assert
  `(result.body['error']! as Map<String, dynamic>).containsKey('details')` is `false`.
- `'should answer the JSON content type when a code is written'` — assert
  `result.headers['content-type']` starts with `'application/json'`. `probe` returns the response
  headers, so no test opens its own client.

Every test registers `addTearDown(daemon.stop)` and asserts `daemon.handlerErrors` is empty.

**Action — GREEN:** the same role writes `test/mock_daemon/error_envelope.dart` and applies the
`_handle` replacement, then re-runs the file.

## Verify

- `make test-one T=test/mock_daemon/contract_enforcement_test.dart` exits 0.
- `make test-one T=test/mock_daemon/mock_daemon_test.dart` still exits 0. The Story 01 test
  `'should answer a request when the daemon is running'` still asserts `404`, and the body it never
  reads is now an envelope.
- `make verify` exits 0.
- Proof: none of its own. It is one third of `PASS 004-G2-ENFORCEMENT`, which Story 04 delivers.
