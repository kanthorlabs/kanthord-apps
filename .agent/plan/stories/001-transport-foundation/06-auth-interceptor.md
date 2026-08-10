# Story 06 — `AuthInterceptor`

Epic: `.agent/plan/epics/001-transport-foundation.md`
Depends on: Story 03 (`ApiUnauthorizedException`), Story 05 (`TokenProviderType`).

## Change

- New `lib/api/interceptors/auth_interceptor.dart`:

  ```dart
  import 'package:dio/dio.dart';

  import '../api_exception.dart';
  import '../token_provider.dart';

  final class AuthInterceptor extends Interceptor {
    const AuthInterceptor(this._tokens);

    final TokenProviderType _tokens;

    @override
    Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
      final token = await _tokens.token();
      if (token == null || token.isEmpty) {
        handler.reject(
          DioException(
            requestOptions: options,
            error: const ApiUnauthorizedException('no daemon token is configured'),
          ),
        );
        return;
      }
      options.headers['Authorization'] = 'Bearer $token';
      handler.next(options);
    }

    @override
    void onError(DioException err, ErrorInterceptorHandler handler) {
      if (err.response?.statusCode == 401) {
        handler.reject(
          DioException(
            requestOptions: err.requestOptions,
            response: err.response,
            error: const ApiUnauthorizedException('the daemon refused the token'),
          ),
        );
        return;
      }
      handler.next(err);
    }
  }
  ```

## Constraints

- The four rules of `docs/api/auth.md` and `docs/testing.md`, and no fifth rule.
- Never call `_tokens.clear()`. Never retry. Never refresh. Build no second `Dio` and no
  single-flight `Future`.
- The rejected `DioException` carries the `ApiUnauthorizedException` in its `error` field, which is
  what `ApiException.fromDio` rule 1 returns unchanged.
- A missing token rejects **before** the request leaves: `handler.next` is never called on that path.

## Tasks

### Task 006.1 — the four assertions

**Input:** `test/api/interceptors/auth_interceptor_test.dart`

**Action — RED:**

- Annotate the file with `@GenerateMocks([TokenProviderType])` and run `make generate-test` in the
  same turn. The generated `test/api/interceptors/auth_interceptor_test.mocks.dart` is part of the
  turn.
- Build a `Dio()` whose `httpClientAdapter` is `MockHttpClientAdapter` from
  `test/api/dio_mock_adapter.dart`, with `options.baseUrl = 'http://127.0.0.1:31415'` and
  `AuthInterceptor(mockTokens)` installed.
- Group `AuthInterceptor`, nested group `onRequest`:
  - `'should attach the bearer token when a token is stored'` — `when(tokens.token())` answers
    `'secret'`; `await dio.get<dynamic>('/v1/health')`; assert
    `adapter.requests.single.headers['Authorization']` equals `'Bearer secret'`.
  - `'should throw unauthorized before the request leaves when the token is null'` — `token()`
    answers `null`; assert the call throws a `DioException` whose `error` is
    `isA<ApiUnauthorizedException>()`, and assert `adapter.requests` is empty.
  - `'should throw unauthorized before the request leaves when the token is empty'` — `token()`
    answers `''`; the same two assertions.
- Nested group `onError`:
  - `'should throw unauthorized when the daemon answers 401'` — the adapter answers `401` with
    `{'error': {'code': 'unauthenticated', 'message': 'no token'}}`; assert the thrown
    `DioException.error` is `isA<ApiUnauthorizedException>()`, and assert `adapter.requests.length`
    equals 1, so no retry happened.
  - `'should keep the stored token when the daemon answers 401'` — after the same `401`, assert
    `verifyNever(tokens.clear())` and that `await tokens.token()` still answers `'secret'`.

**Action — GREEN:** the software-engineer's Task 006.2 creates the seam.

### Task 006.2 — the interceptor

**Input:** `lib/api/interceptors/auth_interceptor.dart`

**Action — GREEN:** write the file exactly as the `## Change` section states.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/api/interceptors/auth_interceptor_test.dart` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: `PASS 001-G5-AUTH`.
