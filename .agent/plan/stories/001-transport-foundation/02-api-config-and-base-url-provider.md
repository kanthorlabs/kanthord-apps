# Story 02 — `BaseUrlProviderType` and `ApiConfig`

Epic: `.agent/plan/epics/001-transport-foundation.md`
Depends on: Story 01 (`make test-one`).

## Change

- New `lib/api/base_url_provider.dart`:

  ```dart
  abstract class BaseUrlProviderType {
    Future<String> baseUrl();
  }
  ```

- New `lib/api/api_config.dart`:

  ```dart
  import 'base_url_provider.dart';

  const _kLongReceiveOperations = <String>{
    'repository.inspect',
    'repository.register',
    'plan.import',
  };

  final class ApiConfig {
    const ApiConfig({required BaseUrlProviderType baseUrlProvider})
      : _baseUrlProvider = baseUrlProvider;

    static const String clientHeader = 'X-Kanthord-Client';
    static const String clientVersion = '1.0.0+1';
    static const Duration connectTimeout = Duration(seconds: 10);
    static const Duration sendTimeout = Duration(seconds: 30);
    static const Duration receiveTimeout = Duration(seconds: 30);
    static const Duration longReceiveTimeout = Duration(seconds: 120);

    final BaseUrlProviderType _baseUrlProvider;

    Future<String> baseUrl() => _baseUrlProvider.baseUrl();

    Duration receiveTimeoutFor(String operation) =>
        _kLongReceiveOperations.contains(operation) ? longReceiveTimeout : receiveTimeout;
  }
  ```

- New `lib/api/interceptors/base_url_interceptor.dart`:

  ```dart
  import 'package:dio/dio.dart';

  import '../api_config.dart';

  final class BaseUrlInterceptor extends Interceptor {
    const BaseUrlInterceptor(this._config);

    final ApiConfig _config;

    @override
    Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
      options.baseUrl = await _config.baseUrl();
      handler.next(options);
    }
  }
  ```

## Constraints

- `ApiConfig` declares no base URL constant, no host and no port. `http://localhost:31415` appears
  nowhere under `lib/api/`.
- Do not add empty-string or null-base-URL handling. No test covers it, and EPIC 003 owns the
  connect-time validation.
- `BaseUrlInterceptor` is the mechanism that satisfies G2: `dio.options.baseUrl` is a plain field, so
  a value captured at construction cannot change per request. It sets `options.baseUrl` on every
  request and does nothing else.
- Comments are forbidden in `lib/api/`. `scripts/arch-check.sh` fails a turn that adds one.

## Tasks

### Task 002.1 — the mock adapter helper and the config test

**Input:** `test/api/dio_mock_adapter.dart`, `test/api/api_config_test.dart`

**Action — RED:**

- Write `test/api/dio_mock_adapter.dart`, the shared adapter every later SDK test uses. It is test
  scaffolding, not a test file, so it declares no `main`. It imports `dart:convert`,
  `dart:typed_data` and `package:dio/dio.dart`:

  ```dart
  final class MockHttpClientAdapter implements HttpClientAdapter {
    final List<RequestOptions> requests = <RequestOptions>[];

    ResponseBody Function(RequestOptions options) respond =
        (options) => jsonResponse(<String, dynamic>{}, 200);

    @override
    Future<ResponseBody> fetch(
      RequestOptions options,
      Stream<Uint8List>? requestStream,
      Future<void>? cancelFuture,
    ) async {
      requests.add(options);
      return respond(options);
    }

    @override
    void close({bool force = false}) {}
  }

  ResponseBody jsonResponse(Object body, int status) => ResponseBody.fromString(
    jsonEncode(body),
    status,
    headers: <String, List<String>>{
      Headers.contentTypeHeader: <String>[Headers.jsonContentType],
    },
  );
  ```

  `respond` carries a default, so a test that only inspects the recorded request assigns nothing. A
  test that asserts a decoded model assigns `adapter.respond` before it acts.

- Write `test/api/api_config_test.dart`, group `ApiConfig`, with these nested method groups and
  tests:
  - group `baseUrl`: `'should return the value the provider holds when the provider is read'` — a
    stub `BaseUrlProviderType` returning `'http://127.0.0.1:31415'`; assert `await config.baseUrl()`
    equals it.
  - group `receiveTimeoutFor`: `'should return the long timeout when the operation is repository.inspect'`,
    `'... when the operation is repository.register'`, `'... when the operation is plan.import'` —
    each asserts `ApiConfig.longReceiveTimeout`; and
    `'should return the default timeout when the operation is system.health'` — asserts
    `ApiConfig.receiveTimeout`.
  - group `clientVersion`: `'should equal the pubspec version when the pubspec is read'` — read
    `pubspec.yaml` with `File('pubspec.yaml').readAsLinesSync()`, take the line that starts with
    `version:`, take the text after `version:`, trim it, and assert it equals
    `ApiConfig.clientVersion`. The whole field is asserted, build number included. The EPIC states
    the constant equals the `version` field, and no rule authorizes stripping the `+1`.
  - group `constants`: `'should declare the client header name when the header is sent'` — asserts
    `ApiConfig.clientHeader` equals `'X-Kanthord-Client'`; and
    `'should declare the connect, send and receive timeouts when the client is built'` — asserts
    `10`, `30` and `30` seconds.

**Action — GREEN:** the software-engineer's Task 002.3 creates the seam.

### Task 002.2 — the per-request base URL test

**Input:** `test/api/base_url_provider_test.dart`

**Action — RED:** group `BaseUrlInterceptor`, nested group `onRequest`, two tests. Each builds a
`Dio()` with `httpClientAdapter` set to `MockHttpClientAdapter`, leaves `adapter.respond` at its
default `200 {}`, and adds `BaseUrlInterceptor(ApiConfig(baseUrlProvider: provider))`.

- `'should send the request to the stored base URL when the provider holds one value'` — the stub
  provider answers `'http://127.0.0.1:31415'`; `await dio.get<dynamic>('/v1/health')`; assert
  `adapter.requests.single.uri.toString()` equals `'http://127.0.0.1:31415/v1/health'`.
- `'should send the second request to the new base URL when the provider value changes between two calls'`
  — one mutable stub provider whose returned value is a field; issue a `GET /v1/health`, set the
  field to `'http://localhost:31415'`, issue a second `GET /v1/health`, and assert the two recorded
  `uri` values are `'http://127.0.0.1:31415/v1/health'` and `'http://localhost:31415/v1/health'`.
  One `Dio`, one interceptor, no re-registration.

The mirrored path for this test is `test/api/interceptors/base_url_interceptor_test.dart`. The EPIC
Proof names `test/api/base_url_provider_test.dart` and the Proof wins.

**Action — GREEN:** the software-engineer's Task 002.3 creates the seam.

### Task 002.3 — the interface, the config and the interceptor

**Input:** `lib/api/base_url_provider.dart`, `lib/api/api_config.dart`,
`lib/api/interceptors/base_url_interceptor.dart`

**Action — GREEN:** write the three files exactly as the `## Change` section states. Both test files
of this Story are red before this Task and green after it.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/api/api_config_test.dart` exits 0.
- `make test-one T=test/api/base_url_provider_test.dart` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: `PASS 001-G1-CONFIG`, `PASS 001-G2-BASE-URL`.
