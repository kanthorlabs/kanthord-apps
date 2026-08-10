# Story 10 — `KanthordApi`

Epic: `.agent/plan/epics/001-transport-foundation.md`
Depends on: Story 02, Story 06, Story 09. It is the last Story of the EPIC.

## Change

- New `lib/api/kanthord_api.dart`:

  ```dart
  import 'package:dio/dio.dart';

  import 'api_config.dart';
  import 'interceptors/auth_interceptor.dart';
  import 'interceptors/base_url_interceptor.dart';
  import 'resources/system_resource.dart';
  import 'token_provider.dart';

  final class KanthordApi {
    KanthordApi({required ApiConfig config, required TokenProviderType tokens, Dio? dio})
      : _config = config,
        dio = dio ?? Dio() {
      this.dio.options.connectTimeout = ApiConfig.connectTimeout;
      this.dio.options.sendTimeout = ApiConfig.sendTimeout;
      this.dio.options.receiveTimeout = ApiConfig.receiveTimeout;
      this.dio.options.headers[ApiConfig.clientHeader] = ApiConfig.clientVersion;
      this.dio.interceptors.add(BaseUrlInterceptor(config));
      this.dio.interceptors.add(AuthInterceptor(tokens));
    }

    final Dio dio;
    final ApiConfig _config;

    late final SystemResource system = SystemResource(dio, _config);
  }
  ```

- New `lib/api/api.dart`, the barrel, exporting every public file of the SDK:

  ```dart
  export 'api_config.dart';
  export 'api_exception.dart';
  export 'api_platform.dart';
  export 'base_url_provider.dart';
  export 'interceptors/auth_interceptor.dart';
  export 'interceptors/base_url_interceptor.dart';
  export 'kanthord_api.dart';
  export 'models/db_status.dart';
  export 'models/dependency_status.dart';
  export 'models/health.dart';
  export 'models/health_dependency.dart';
  export 'models/health_status.dart';
  export 'models/migration.dart';
  export 'models/wire_enum.dart';
  export 'resources/system_resource.dart';
  export 'token_provider.dart';
  ```

## Constraints

- The interceptor order is `BaseUrlInterceptor` first, then `AuthInterceptor`, on a passed `Dio` and
  on a built one alike.
- `dio` is a public final field, because the test asserts the built options and EPIC 005 adds
  interceptors to the same instance.
- `system` is a lazy field, so one `KanthordApi` returns the same `SystemResource` on every read.
- Add no retry, no idempotency and no logging interceptor. EPIC 005 owns each.
- Register nothing in `get_it` here. EPIC 002 owns the composition root.

## Tasks

### Task 010.1 — the client test

**Input:** `test/api/kanthord_api_test.dart`

**Action — RED:** group `KanthordApi`, nested group `constructor`:

- `'should build a Dio with the configured timeouts when no Dio is passed'` — assert
  `api.dio.options.connectTimeout` is 10 seconds and both other timeouts are 30 seconds.
- `'should send the client version header when no Dio is passed'` — assert
  `api.dio.options.headers[ApiConfig.clientHeader]` equals `ApiConfig.clientVersion`.
- `'should install the base URL interceptor before the auth interceptor when the client is built'` —
  assert the last two entries of `api.dio.interceptors` are `isA<BaseUrlInterceptor>()` then
  `isA<AuthInterceptor>()`.
- `'should use the passed Dio when a Dio is passed'` — assert `identical(api.dio, passedDio)`.

Nested group `system`:

- `'should return the same resource when system is read twice'` — assert
  `identical(api.system, api.system)`.

Nested group `system`, the outgoing-request tests. Each builds one `KanthordApi` on a `Dio` whose
`httpClientAdapter` is `MockHttpClientAdapter`, with a mutable stub `BaseUrlProviderType` answering
`'http://127.0.0.1:31415'` and a stub `TokenProviderType` answering `'secret'`, and sets
`adapter.respond` to the `success` object of `docs/api/contract/examples/system.health.json` at
status `200`:

- `'should send the client version header when a resource method is called'` — `await api.system.health()`;
  assert `adapter.requests.single.headers[ApiConfig.clientHeader]` equals `ApiConfig.clientVersion`.
  The test installs no header itself. This is what proves `KanthordApi` configures the outgoing
  request, which a header set inside a resource test could not prove.
- `'should send the bearer token when a resource method is called'` — assert the same request carries
  `Authorization: Bearer secret`.
- `'should send the second request to the new base URL when the provider value changes between two calls'`
  — call `api.system.health()`, change the provider field to `'http://localhost:31415'`, call it
  again, and assert the two recorded request URLs are
  `'http://127.0.0.1:31415/v1/health'` and `'http://localhost:31415/v1/health'`. This is the EPIC
  hermetic bullet, asserted from one `KanthordApi` instance.

**Action — GREEN:** the software-engineer's Task 010.2 creates the seam.

### Task 010.2 — the client and the barrel

**Input:** `lib/api/kanthord_api.dart`, `lib/api/api.dart`

**Action — GREEN:** write the two files exactly as the `## Change` section states.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/api/kanthord_api_test.dart` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- The whole EPIC `Proof:` block runs and prints `PASS EPIC-001`.
- Proof: `PASS 001-G6-CLIENT`, `PASS 001-G8-BOUNDARY`, `PASS EPIC-001`.
- `NEEDS-HUMAN:` **deferred to EPIC 003, and nothing in EPIC 001 proves it.** The EPIC calls for a
  Chrome run, and a Chrome run cannot exercise this code here: `lib/app/kanthord_app.dart` still
  shows `KDGalleryPage`, nothing composes `KanthordApi`, and an unreferenced library may not even
  reach the web bundle. EPIC 003 is the first slice a human can run, and it is where the web build
  of `lib/api/` is actually proven. Report this deferral in the ready marker. Do not report a
  `make dev` run as evidence for the transport.
