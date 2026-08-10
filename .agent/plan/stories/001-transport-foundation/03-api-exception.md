# Story 03 — `ApiException`

Epic: `.agent/plan/epics/001-transport-foundation.md`
Depends on: Story 02 (`ApiConfig` exists, `lib/api/` exists).

## Change

- New `lib/api/api_exception.dart`, one file, seven subclasses and one entry point:

  ```dart
  sealed class ApiException implements Exception {
    const ApiException(this.message);

    final String message;

    static ApiException fromDio(DioException error, {required bool isWeb}) { ... }
  }

  final class ApiNoNetworkException extends ApiException {
    const ApiNoNetworkException(super.message);
  }

  final class ApiTimeoutException extends ApiException {
    const ApiTimeoutException(super.message);
  }

  final class ApiUnauthorizedException extends ApiException {
    const ApiUnauthorizedException(super.message);
  }

  final class ApiNotImplementedException extends ApiException {
    const ApiNotImplementedException(super.message);
  }

  final class ApiResponseException extends ApiException {
    const ApiResponseException({
      required this.status,
      required this.code,
      required String message,
      this.details,
    }) : super(message);

    final int status;
    final String code;
    final Map<String, dynamic>? details;
  }

  final class ApiDecodeException extends ApiException {
    const ApiDecodeException(super.message);
  }

  final class ApiCancelledException extends ApiException {
    const ApiCancelledException(super.message);
  }
  ```

- `ApiException.fromDio` applies these rules in this order, and no other rule:

  1. `error.error is ApiException` → return that instance unchanged. An interceptor that rejects with
     an `ApiException` inside a `DioException` is not re-mapped.
  2. `DioExceptionType.connectionTimeout`, `sendTimeout`, `receiveTimeout` →
     `ApiTimeoutException('the daemon did not answer in time')`.
  3. `DioExceptionType.cancel` → `ApiCancelledException('the request was cancelled')`.
  4. `DioExceptionType.connectionError`, `badCertificate`, `unknown` → the no-network branch. Story 04
     owns its two messages. Until Story 04 lands, the message is
     `'no answer from the daemon at $authority.'`, where
     `authority = error.requestOptions.uri.authority`.
  5. `DioExceptionType.badResponse` → the envelope branch below.

- The envelope branch, on `error.response`:
  - `response.data is! Map<String, dynamic>` → `ApiDecodeException('the daemon answered a body that is not the error envelope')`.
  - `data['error'] is! Map<String, dynamic>` → the same `ApiDecodeException`.
  - `envelope['code'] is! String` or `envelope['message'] is! String` → the same
    `ApiDecodeException`.
  - `details` = `envelope['details'] is Map<String, dynamic> ? envelope['details'] as Map<String, dynamic> : null`.
  - `status` = `error.response?.statusCode ?? 0`.
  - `code == 'unauthenticated'` → `ApiUnauthorizedException(message)`.
  - `code == 'not-implemented'` → `ApiNotImplementedException(message)`.
  - `code == 'host-forbidden'` → `ApiResponseException` with `status`, `code`, `details` and the
    message `'the daemon refused the Host header $authority. Add it to KANTHORD_HTTP_ALLOWED_HOSTS on the daemon.'`.
  - every other code → `ApiResponseException(status: status, code: code, message: message, details: details)`,
    the raw `code` string kept whether or not it is in the `docs/api/errors.md` table.

## Constraints

- Branch on `code`, never on the HTTP status, and never parse `message`. `docs/api/errors.md`.
- A `plan-invalid` finding code is never mapped. It stays inside `details['findings']` on one
  `ApiResponseException` whose `code` is `plan-invalid`.
- Add no eighth subclass, and add no `Either`, no `Result` and no error return value.
- `lib/api/api_exception.dart` imports `package:dio/dio.dart` and nothing from `package:flutter/`.
- Comments are forbidden in `lib/api/`.

## Tasks

### Task 003.1 — the mapping test

**Input:** `test/api/api_exception_test.dart`

**Action — RED:** group `ApiException`, nested group `fromDio`, with these tests. Build each
`DioException` with `requestOptions: RequestOptions(path: '/v1/health', baseUrl: 'http://127.0.0.1:31415')`
and, where a response is needed, `Response<dynamic>(requestOptions: ..., statusCode: ..., data: ...)`.

- `'should return the carried exception when the DioException carries an ApiException'` — `error:`
  holds `const ApiUnauthorizedException('carried')`; assert `identical` to that instance.
- `'should map to a timeout when the type is connectionTimeout'`, `'... sendTimeout'`,
  `'... receiveTimeout'` — each asserts `isA<ApiTimeoutException>()`.
- `'should map to cancelled when the type is cancel'` — `isA<ApiCancelledException>()`.
- `'should map to no network when the type is connectionError'` — `isA<ApiNoNetworkException>()`.
- `'should map to unauthorized when the code is unauthenticated'` — `401` plus
  `{'error': {'code': 'unauthenticated', 'message': 'no token'}}`; assert
  `isA<ApiUnauthorizedException>()` and `message` equals `'no token'`.
- `'should map to not implemented when the code is not-implemented'` — `501`; assert
  `isA<ApiNotImplementedException>()`.
- One test per remaining baseline code of `docs/api/errors.md` —
  `'should map to a response error when the code is invalid-request'` at `400`,
  `'... origin-forbidden'` at `403`, `'... not-found'` at `404`, `'... internal-error'` at `500`,
  `'... service-unavailable'` at `503`. Each asserts `isA<ApiResponseException>()`, and that
  `status` and `code` match the sent values.
- `'should keep the raw code when the code is outside the table'` — `418` plus code
  `'teapot-unknown'`; assert `isA<ApiResponseException>()` and `code` equals `'teapot-unknown'`.
- `'should name the host and the config key when the code is host-forbidden'` — `403` plus code
  `'host-forbidden'`; assert the message contains `'127.0.0.1:31415'` and
  `'KANTHORD_HTTP_ALLOWED_HOSTS'`.
- `'should keep the findings as details when the code is plan-invalid'` — `422` plus
  `{'error': {'code': 'plan-invalid', 'message': 'invalid', 'details': {'findings': [{'code': 'dependency-cycle'}]}}}`;
  assert `isA<ApiResponseException>()`, `code` equals `'plan-invalid'`, and
  `details!['findings']` is a `List` of length 1. Assert no finding code ever became an exception
  type.
- `'should map to a decode error when the body is not the envelope'` — `500` with
  `data: 'not json'`; assert `isA<ApiDecodeException>()`.
- `'should map to a decode error when the envelope has no code'` — `500` with
  `{'error': {'message': 'x'}}`; assert `isA<ApiDecodeException>()`.

Pass `isWeb: false` on every call in this Task. Story 04 owns the `isWeb: true` cases.

**Action — GREEN:** the software-engineer's Task 003.2 creates the seam.

### Task 003.2 — the hierarchy and the decoder

**Input:** `lib/api/api_exception.dart`

**Action — GREEN:** write the file exactly as the `## Change` section states.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/api/api_exception_test.dart` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: `PASS 001-G3-ERRORS`, together with Story 04.
