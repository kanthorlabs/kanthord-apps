# Story 03 — `ApiNotConfiguredException`

Epic: `.agent/plan/epics/001.1-candidate-client-and-daemon-pinning.md`
Depends on: EPIC 001 (the sealed `ApiException` hierarchy).

## Change

- `lib/api/api_exception.dart:121` — add one subclass after `ApiCancelledException`, at the end of
  the file:

  ```dart
  final class ApiNotConfiguredException extends ApiException {
    const ApiNotConfiguredException(super.message);
  }
  ```

## Constraints

- `ApiException.fromDio` and `ApiException._fromResponse` are **not** edited. No new
  `DioExceptionType` branch, no new envelope code branch, no change to the eight existing mappings.
- The subclass is `final class` and extends `ApiException`, so it joins the sealed hierarchy and
  every `switch` over `ApiException` must handle it.
- No new envelope code maps to it. It is produced by `BaseUrlInterceptor` alone, in Story 04.

## Tasks

### Task 003.1 — the subclass and the two decoder rules

**Input:** `test/api/api_exception_test.dart`

**Action — RED:** add one new top-level group, `ApiNotConfiguredException`, after the existing
`ApiException` group:

- Nested group `constructor`:
  - `'should carry its message when it is constructed'` — assert
    `const ApiNotConfiguredException('no daemon is selected').message` equals
    `'no daemon is selected'`.
  - `'should be an ApiException when it is constructed'` — assert
    `const ApiNotConfiguredException('x')` is `isA<ApiException>()`.

Add a nested group `notConfigured` inside the existing `ApiException` > `fromDio` group:

- `'should never decode a daemon answer to not-configured for any DioException type'` — iterate
  `DioExceptionType.values`; for each value build
  `DioException(requestOptions: RequestOptions(path: '/v1/health'), type: value)` with no `error` and
  no `response`; assert `ApiException.fromDio(error, isWeb: false)` is
  `isNot(isA<ApiNotConfiguredException>())`, and assert the same with `isWeb: true`.
- `'should never decode an error envelope to not-configured when the daemon answers'` — build a
  `DioException` of type `DioExceptionType.badResponse` whose `Response` holds
  `{'error': {'code': 'not-configured', 'message': 'x'}}` with status `500`; assert the result is
  `isA<ApiResponseException>()` and `isNot(isA<ApiNotConfiguredException>())`, and assert its `code`
  is `'not-configured'` — an unknown code keeps its raw string.
- `'should return the carried not-configured exception when an interceptor rejected the request'` —
  build a `DioException` whose `error` is `const ApiNotConfiguredException('no daemon is selected')`;
  assert `ApiException.fromDio(error, isWeb: false)` is `isA<ApiNotConfiguredException>()` and is
  `identical` to the carried instance. This is `fromDio` rule 1, and it is how a resource method
  surfaces the interceptor rejection of Story 04.

**Action — GREEN:** the software-engineer's Task 003.2 creates the seam.

### Task 003.2 — the subclass

**Input:** `lib/api/api_exception.dart`

**Action — GREEN:** add the subclass exactly as the `## Change` section states.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/api/api_exception_test.dart` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: `PASS 001.1-G6-NOT-CONFIGURED`.
