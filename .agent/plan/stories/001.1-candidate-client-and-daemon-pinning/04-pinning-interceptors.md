# Story 04 — the pinning interceptors

Epic: `.agent/plan/epics/001.1-candidate-client-and-daemon-pinning.md`
Depends on: Story 01 (`kDaemonIdKey`), Story 02 (`endpoint()`, `tokenOf()`), Story 03
(`ApiNotConfiguredException`).

## Change

- `lib/api/interceptors/base_url_interceptor.dart:1-15` — replace the whole file:

  ```dart
  import 'package:dio/dio.dart';

  import '../api_config.dart';
  import '../api_exception.dart';
  import '../daemon_endpoint.dart';

  final class BaseUrlInterceptor extends Interceptor {
    const BaseUrlInterceptor(this._config);

    final ApiConfig _config;

    @override
    Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
      if (options.extra[kDaemonIdKey] is String) {
        handler.next(options);
        return;
      }
      final endpoint = await _config.endpoint();
      if (endpoint == null) {
        handler.reject(
          DioException(
            requestOptions: options,
            error: const ApiNotConfiguredException('no daemon is selected'),
          ),
        );
        return;
      }
      options.baseUrl = endpoint.baseUrl;
      options.extra[kDaemonIdKey] = endpoint.id;
      handler.next(options);
    }
  }
  ```

- `lib/api/interceptors/auth_interceptor.dart:12-13` — replace the single token read

  ```dart
  final token = await _tokens.token();
  ```

  with

  ```dart
  final daemonId = options.extra[kDaemonIdKey];
  final token = daemonId is String ? await _tokens.tokenOf(daemonId) : await _tokens.token();
  ```

  and add `import '../daemon_endpoint.dart';` after `import '../api_exception.dart';` at
  `lib/api/interceptors/auth_interceptor.dart:3`.

## Constraints

- `BaseUrlInterceptor.onRequest` calls `_config.endpoint()` **at most once** per pass, and **not at
  all** when the request already carries a `String` at `options.extra[kDaemonIdKey]`. It never calls
  `_config.baseUrl()`.
- **The pin survives a second pass through the chain.** `Dio.fetch(requestOptions)`
  (`dio-5.11.0/lib/src/dio_mixin.dart:418`) re-runs the whole request interceptor chain, which is how
  a retry re-sends a request. Without the early return, a retry would resolve `endpoint()` again and
  could migrate to a second daemon, and the pinning rule of the EPIC would be a promise EPIC 005 has
  to keep rather than an invariant the SDK holds. The early return also keeps the `options.baseUrl`
  the first pass set.
- A **valid pin is a `String` value** at `options.extra[kDaemonIdKey]`. Any other value, including a
  non-`String`, is not a pin: `BaseUrlInterceptor` overwrites it with a resolved id. So in the
  composed stack `AuthInterceptor` always reads a `String`, and its `token()` fallback fires only when
  the interceptor runs without `BaseUrlInterceptor` in front of it — its own unit test, and the EPIC
  001 G5 contract. `AuthInterceptor` therefore needs no malformed-value branch, and it must not grow
  one: the invariant is enforced upstream, not defended twice.
- `AuthInterceptor` never calls `_config.endpoint()` and never resolves a daemon. It reads
  `options.extra[kDaemonIdKey]` only.
- Every other rule of EPIC 001 G5 is unchanged: a null or empty token rejects before the request
  leaves, a `401` rejects with `ApiUnauthorizedException`, and `_tokens.clear()` is never called.
- `AuthInterceptor.onError` is not edited.
- Both classes stay `const`-constructible `final class`.
- No comment in either file. `scripts/arch-check.sh:82`.

## Tasks

### Task 004.1 — the base URL interceptor moves to its mirror path

**Input:** `test/api/interceptors/base_url_interceptor_test.dart`,
`test/api/base_url_provider_test.dart`

**Action — RED:**

- Create `test/api/interceptors/base_url_interceptor_test.dart`. Move the whole existing
  `BaseUrlInterceptor` group — the one whose two tests are named
  `'should send the request to the stored base URL when the provider holds one'` and
  `'should send the second request to the new base URL when the provider value changes between two calls'` —
  out of `test/api/base_url_provider_test.dart` and into the new file, with the two stubs it needs,
  and change the relative import of the adapter to `'../dio_mock_adapter.dart'`. The two moved tests
  keep their names and their assertions. Anchor on the group and the test names, not on a line number:
  Story 02 Task 002.2 inserts a group above this one, so the line range shifts before this Task runs.
- Delete that `BaseUrlInterceptor` group and the two now-unused stubs from
  `test/api/base_url_provider_test.dart`. The `StaticBaseUrlProvider`, `BaseUrlProviderType` and
  `_UnselectedBaseUrlProvider` content Story 02 added stays, and the file no longer imports
  `dio_mock_adapter.dart`, `package:dio/dio.dart` or `BaseUrlInterceptor`.
- In the new file, add these stubs, written exactly so:

  ```dart
  final class _StaticEndpointProvider implements BaseUrlProviderType {
    _StaticEndpointProvider(this._endpoint);

    final DaemonEndpoint _endpoint;
    int calls = 0;

    @override
    Future<String> baseUrl() async => _endpoint.baseUrl;

    @override
    Future<DaemonEndpoint?> endpoint() async {
      calls = calls + 1;
      return _endpoint;
    }
  }

  final class _UnselectedBaseUrlProvider implements BaseUrlProviderType {
    const _UnselectedBaseUrlProvider();

    @override
    Future<String> baseUrl() async => '';

    @override
    Future<DaemonEndpoint?> endpoint() async => null;
  }

  final class _FlippingProvider implements BaseUrlProviderType {
    _FlippingProvider(this.selected, this._next);

    DaemonEndpoint selected;
    final DaemonEndpoint _next;

    @override
    Future<String> baseUrl() async => selected.baseUrl;

    @override
    Future<DaemonEndpoint?> endpoint() async {
      final resolved = selected;
      selected = _next;
      return resolved;
    }
  }

  final class _ScopedTokenProvider implements TokenProviderType {
    _ScopedTokenProvider(this._selection, this._tokens);

    final _FlippingProvider _selection;
    final Map<String, String> _tokens;

    @override
    Future<String?> token() async => _tokens[_selection.selected.id];

    @override
    Future<String?> tokenOf(String daemonId) async => _tokens[daemonId];

    @override
    Future<void> save(String token) async {}

    @override
    Future<void> clear() async {}
  }
  ```

  `_ScopedTokenProvider.token()` reads the selection **at call time**, so it answers daemon `b`'s
  token once `_FlippingProvider.endpoint()` has flipped. That is what makes the pinning-pair test
  fail if `AuthInterceptor` uses the unscoped read.

- Extend the group `BaseUrlInterceptor` with a nested group `onRequest`:
  - `'should pin the resolved daemon id into the request extra when the provider holds an endpoint'` —
    `_StaticEndpointProvider` over `DaemonEndpoint(id: 'local', name: 'local', baseUrl: 'http://127.0.0.1:31415')`;
    `await dio.get<dynamic>('/v1/health')`; assert `adapter.requests.single.extra[kDaemonIdKey]`
    equals `'local'`, and assert `adapter.requests.single.uri.toString()` equals
    `'http://127.0.0.1:31415/v1/health'`.
  - `'should resolve the endpoint one time when one request is sent'` — assert the stub's `calls`
    equals `1`.
  - `'should throw not-configured before the request leaves when no daemon is selected'` —
    `const _UnselectedBaseUrlProvider()`; assert the call throws a `DioException` whose `error` is
    `isA<ApiNotConfiguredException>()`, and assert `adapter.requests` is empty.
  - `'should keep the pinned daemon when the request runs through the chain a second time'` — the
    retry guard. `_StaticEndpointProvider` over
    `DaemonEndpoint(id: 'local', name: 'local', baseUrl: 'http://127.0.0.1:31415')`; build
    `final options = RequestOptions(path: '/v1/health', baseUrl: 'http://10.0.0.5:31415', extra: <String, dynamic>{kDaemonIdKey: 'remote'})`;
    `await dio.fetch<dynamic>(options)`; assert the stub's `calls` equals `0`, assert
    `adapter.requests.single.extra[kDaemonIdKey]` equals `'remote'`, and assert
    `adapter.requests.single.uri.toString()` equals `'http://10.0.0.5:31415/v1/health'`.
    `Dio.fetch` re-runs the request interceptor chain
    (`dio-5.11.0/lib/src/dio_mixin.dart:418`), so this is the shape EPIC 005 retries take.
  - `'should overwrite the daemon id when the request carries a value that is not a String'` —
    `_StaticEndpointProvider` over the `'local'` endpoint; build a `RequestOptions` whose
    `extra` holds `<String, dynamic>{kDaemonIdKey: 42}`; `await dio.fetch<dynamic>(options)`; assert
    the stub's `calls` equals `1` and `adapter.requests.single.extra[kDaemonIdKey]` equals `'local'`.
    A non-`String` is not a pin, so it is replaced rather than trusted, and `AuthInterceptor` never
    sees it.
- Add a nested group `the pinning pair`, with both interceptors installed in EPIC 001 order over
  `final flipping = _FlippingProvider(const DaemonEndpoint(id: 'a', name: 'a', baseUrl: 'http://127.0.0.1:31415'), const DaemonEndpoint(id: 'b', name: 'b', baseUrl: 'http://10.0.0.5:31415'))`
  — `BaseUrlInterceptor(ApiConfig(baseUrlProvider: flipping))` then
  `AuthInterceptor(_ScopedTokenProvider(flipping, <String, String>{'a': 'token-a', 'b': 'token-b'}))`:
  - `'should send the token of the pinned daemon when the selection changes between the two interceptors'` —
    `await dio.get<dynamic>('/v1/health')`; assert `adapter.requests.single.extra[kDaemonIdKey]`
    equals `'a'`, assert `adapter.requests.single.uri.toString()` equals
    `'http://127.0.0.1:31415/v1/health'`, and assert
    `adapter.requests.single.headers['Authorization']` equals `'Bearer token-a'`. The unscoped
    `token()` would have answered `'token-b'`, so this proves the pair never mixes daemon A's URL
    with daemon B's token.
  - `'should send daemon b on the next request when the selection moved'` — a second
    `await dio.get<dynamic>('/v1/health')` on the same `Dio`; assert
    `adapter.requests[1].extra[kDaemonIdKey]` equals `'b'`, assert `adapter.requests[1].uri.toString()`
    equals `'http://10.0.0.5:31415/v1/health'`, and assert
    `adapter.requests[1].headers['Authorization']` equals `'Bearer token-b'`. A fresh request carries
    an empty `extra`, so it resolves again — the pin binds one request, not the client.

**Action — GREEN:** the software-engineer's Task 004.3 creates the seam.

### Task 004.2 — the scoped token read

**Input:** `test/api/interceptors/auth_interceptor_test.dart`

**Action — RED:** extend the existing `AuthInterceptor` > `onRequest` group. `MockTokenProviderType`
already exists in `test/api/interceptors/auth_interceptor_test.mocks.dart` and carries `tokenOf`
after Story 02 Task 002.4 regenerated it, so this Task adds no annotation and runs no codegen.

- `'should read the token of the pinned daemon when the request carries a daemon id'` —
  `when(tokens.tokenOf('local'))` answers `'token-local'` and `when(tokens.token())` answers
  `'wrong'`; send `dio.get<dynamic>('/v1/health', options: Options(extra: {kDaemonIdKey: 'local'}))`;
  assert `adapter.requests.single.headers['Authorization']` equals `'Bearer token-local'`, and assert
  `verifyNever(tokens.token())`.
- `'should read the unscoped token when the request carries no daemon id'` — `when(tokens.token())`
  answers `'secret'`; send `dio.get<dynamic>('/v1/health')`; assert the header equals
  `'Bearer secret'`, and assert `verifyNever(tokens.tokenOf(any))`.
- `'should read the unscoped token when the daemon id extra is not a String'` —
  `when(tokens.token())` answers `'secret'`; send
  `dio.get<dynamic>('/v1/health', options: Options(extra: {kDaemonIdKey: 42}))`; assert the header
  equals `'Bearer secret'`, and assert `verifyNever(tokens.tokenOf(any))`. This is the standalone
  contract only. In the composed stack `BaseUrlInterceptor` replaces a non-`String` with a resolved
  id first, which Task 004.1 proves, so no request ever reaches this branch with a malformed pin.
- `'should throw unauthorized before the request leaves when the pinned daemon holds no token'` —
  `when(tokens.tokenOf('local'))` answers `null`; send the request with
  `extra: {kDaemonIdKey: 'local'}`; assert the call throws a `DioException` whose `error` is
  `isA<ApiUnauthorizedException>()`, and assert `adapter.requests` is empty.

Add `import 'package:kanthord/api/daemon_endpoint.dart';` to the file. Change no existing test in it.

**Action — GREEN:** the software-engineer's Task 004.3 creates the seam.

### Task 004.3 — the two interceptors

**Input:** `lib/api/interceptors/base_url_interceptor.dart`,
`lib/api/interceptors/auth_interceptor.dart`

**Action — GREEN:** write the two edits exactly as the `## Change` section states.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/api/interceptors/base_url_interceptor_test.dart` exits 0.
- `make test-one T=test/api/interceptors/auth_interceptor_test.dart` exits 0.
- `make test-one T=test/api/base_url_provider_test.dart` exits 0 after the group moved out.
- `make test-one T=test/api/kanthord_api_test.dart` exits 0 — the EPIC 001 regression guard, whose
  stubs answer a non-null `endpoint()` after Story 02.
- `make test-one T=test/api/resources/system_resource_test.dart` exits 0 — the EPIC 001 regression
  guard.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: `PASS 001.1-G4-PIN`, `PASS 001.1-G5-SCOPED-TOKEN`.
