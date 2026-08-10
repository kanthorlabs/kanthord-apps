# Story 05 — `withCandidate` and `adapterFactory`

Epic: `.agent/plan/epics/001.1-candidate-client-and-daemon-pinning.md`
Depends on: Story 01 (`DaemonEndpoint`, `kCandidateDaemonId`), Story 02 (`StaticBaseUrlProvider`,
`StaticTokenProvider`), Story 04 (the interceptor pair).

## Change

- `lib/api/kanthord_api.dart:1-25` — replace the whole file:

  ```dart
  import 'package:dio/dio.dart';

  import 'api_config.dart';
  import 'base_url_provider.dart';
  import 'daemon_endpoint.dart';
  import 'interceptors/auth_interceptor.dart';
  import 'interceptors/base_url_interceptor.dart';
  import 'resources/system_resource.dart';
  import 'token_provider.dart';

  final class KanthordApi {
    KanthordApi({
      required ApiConfig config,
      required TokenProviderType tokens,
      Dio? dio,
      HttpClientAdapter Function()? adapterFactory,
    }) : _config = config,
         _adapterFactory = adapterFactory,
         dio = dio ?? Dio() {
      if (dio == null && adapterFactory != null) {
        this.dio.httpClientAdapter = adapterFactory();
      }
      this.dio.options.connectTimeout = ApiConfig.connectTimeout;
      this.dio.options.sendTimeout = ApiConfig.sendTimeout;
      this.dio.options.receiveTimeout = ApiConfig.receiveTimeout;
      this.dio.options.headers[ApiConfig.clientHeader] = ApiConfig.clientVersion;
      this.dio.interceptors.add(BaseUrlInterceptor(config));
      this.dio.interceptors.add(AuthInterceptor(tokens));
    }

    final Dio dio;
    final ApiConfig _config;
    final HttpClientAdapter Function()? _adapterFactory;

    late final SystemResource system = SystemResource(dio, _config);

    KanthordApi withCandidate({required String baseUrl, required String token}) => KanthordApi(
      config: ApiConfig(
        baseUrlProvider: StaticBaseUrlProvider(
          DaemonEndpoint(id: kCandidateDaemonId, name: 'candidate', baseUrl: baseUrl),
        ),
      ),
      tokens: StaticTokenProvider(token),
      adapterFactory: _adapterFactory,
    );
  }
  ```

## Constraints

- `withCandidate` is an **instance** method, because it passes the parent's `_adapterFactory` on.
  EPIC 003 G3 calls it as `api.withCandidate(baseUrl:, token:)`.
- `withCandidate` **clones nothing**. It calls the ordinary constructor and passes no `Dio`, so the
  candidate builds its own `Dio` and its own interceptor pair.
- The candidate endpoint id is `kCandidateDaemonId` and its name is the literal `'candidate'`. The
  name is never displayed and is never read by the SDK.
- The factory is applied **only to the `Dio` the constructor builds** — the `dio == null` branch,
  which is G8 read literally. A caller who passes a `Dio` owns its adapter, and the constructor never
  replaces it. Replacing the adapter of an externally owned `Dio` is observable behavior nothing in
  the EPIC authorizes.
- The factory is applied **before** the timeouts, the header and the interceptors, so the ordering of
  the EPIC 001 constructor assertions does not change.
- The four EPIC 001 constructor behaviors are unchanged: the three timeouts, the client version
  header, `BaseUrlInterceptor` installed before `AuthInterceptor`, and a passed `Dio` used by
  identity.
- Add no `KanthordApiType`. `KanthordApi` stays `final class`.
- Do not store `tokens` in a field. `withCandidate` builds a `StaticTokenProvider` and never reads
  the parent's provider, so a `_tokens` field would be unused.
- No comment in the file. `scripts/arch-check.sh:82`.

## Tasks

### Task 005.1 — the shared mock adapter observes close and delay

**Input:** `test/api/dio_mock_adapter.dart`

**Action — RED:** `MockHttpClientAdapter` gains two fields, and its `fetch` and `close` overrides are
replaced. `requests`, `respond` and `jsonResponse` do not change, so every existing SDK test keeps
compiling and passing. The class becomes:

```dart
int closeCalls = 0;

Future<void>? hold;

@override
Future<ResponseBody> fetch(
  RequestOptions options,
  Stream<Uint8List>? requestStream,
  Future<void>? cancelFuture,
) async {
  requests.add(options);
  final gate = hold;
  if (gate != null) {
    await gate;
  }
  return respond(options);
}

@override
void close({bool force = false}) {
  closeCalls = closeCalls + 1;
}
```

`closeCalls` makes a close observable. `hold` parks one adapter's response, so two requests overlap.
`requests.add` runs **before** the gate, so a parked request is still recorded as started.

Add nothing beyond those two fields. `close` records the call and does not make `fetch` fail, because
`Dio.close` already refuses a later request through the client
(`dio-5.11.0/lib/src/dio_mixin.dart:407`), which is the assertion Task 005.2 makes.

**Action — GREEN:** none. This Task changes no production code.

### Task 005.2 — the candidate and the adapter seam

**Input:** `test/api/kanthord_api_test.dart`

**Action — RED:** add to the file. Change no existing test.

- Add a helper `_RecordingAdapterFactory` — a `final class` holding
  `final List<MockHttpClientAdapter> created = <MockHttpClientAdapter>[];` and a method
  `MockHttpClientAdapter call() { final adapter = MockHttpClientAdapter(); created.add(adapter); return adapter; }`.
  `created[0]` is then the parent's adapter and `created[1]` is the candidate's.
- Add a nested group `adapterFactory` inside the existing `KanthordApi` group:
  - `'should install the adapter the factory builds when no Dio is passed'` — build a `KanthordApi`
    with `adapterFactory: factory.call` over
    `ApiConfig(baseUrlProvider: _StubBaseUrlProvider('http://127.0.0.1:31415'))`; assert
    `identical(api.dio.httpClientAdapter, factory.created.single)` is `isTrue`.
  - `'should keep the configured timeouts when the factory installs an adapter'` — assert the three
    timeouts still equal 10 s, 30 s and 30 s.
  - `'should keep the adapter of the passed Dio when a Dio and a factory are both passed'` — build a
    `Dio` whose `httpClientAdapter` is an own `MockHttpClientAdapter`, pass it as `dio:` **and** pass
    `adapterFactory: factory.call`; assert `factory.created` is empty, and assert
    `identical(api.dio.httpClientAdapter, ownAdapter)` is `isTrue`. A caller who passes a `Dio` owns
    its adapter.
- Add a nested group `withCandidate` inside the existing `KanthordApi` group:
  - `'should return a new client when a candidate is built'` — assert
    `identical(parent, candidate)` is `isFalse`, and assert `identical(parent.dio, candidate.dio)` is
    `isFalse`.
  - `'should install the interceptor pair on the candidate when a candidate is built'` — assert
    `candidate.dio.interceptors[candidate.dio.interceptors.length - 2]` is `isA<BaseUrlInterceptor>()`
    and `candidate.dio.interceptors.last` is `isA<AuthInterceptor>()`.
  - `'should send the candidate request to the entered base URL when the candidate is used'` — build
    the parent with `adapterFactory: factory.call` and
    `_StubBaseUrlProvider('http://127.0.0.1:31415')`, then
    `parent.withCandidate(baseUrl: 'http://192.168.1.9:31415', token: 'entered')`;
    `await candidate.dio.get<dynamic>('/v1/health')`; assert
    `factory.created[1].requests.single.uri.toString()` equals
    `'http://192.168.1.9:31415/v1/health'`.
  - `'should pin the candidate daemon id when the candidate is used'` — assert
    `factory.created[1].requests.single.extra[kDaemonIdKey]` equals `kCandidateDaemonId`.
  - `'should send the entered token when the candidate is used'` — assert
    `factory.created[1].requests.single.headers['Authorization']` equals `'Bearer entered'`.
  - `'should build a second adapter from the factory when a candidate is built'` — assert
    `factory.created` has length `2` immediately after `parent.withCandidate(...)` and before any
    request, and assert `identical(candidate.dio.httpClientAdapter, factory.created[1])` is `isTrue`.
    The candidate answers from the factory the parent carried, which is the seam a feature test needs.
  - `'should not close the parent adapter when the candidate is closed'` —
    `candidate.dio.close(force: true)`; assert `factory.created[1].closeCalls` equals `1` and
    `factory.created[0].closeCalls` equals `0`.
  - `'should keep the parent able to issue a request when the candidate is closed'` — after the same
    close, `await parent.dio.get<dynamic>('/v1/health')`; assert `factory.created[0].requests` has
    length `1`. Then assert the candidate is genuinely closed:
    `await expectLater(candidate.dio.get<dynamic>('/v1/health'), throwsA(isA<DioException>()))`.
    `Dio.close` sets a private `_closed` flag and a later request throws
    `DioException.connectionError` (`dio-5.11.0/lib/src/dio_mixin.dart:57` and `:407`), so this pair
    of assertions proves the two clients have separate lifetimes rather than proving nothing.
  - `'should keep the two requests apart when the parent and the candidate act at the same time'` —
    park the parent with `final gate = Completer<void>(); factory.created[0].hold = gate.future;`; set
    `factory.created[0].respond` to `(_) => jsonResponse(<String, dynamic>{'who': 'parent'}, 200)` and
    `factory.created[1].respond` to `(_) => jsonResponse(<String, dynamic>{'who': 'candidate'}, 200)`;
    start `final parentRequest = parent.dio.get<dynamic>('/v1/health');` without awaiting it;
    `final candidateResponse = await candidate.dio.get<dynamic>('/v1/health');` assert
    `candidateResponse.data` decodes to `{'who': 'candidate'}` while the parent is still parked, and
    assert `factory.created[1].requests.single.headers['Authorization']` equals `'Bearer entered'`;
    then `gate.complete();` and `final parentResponse = await parentRequest;` assert
    `parentResponse.data` decodes to `{'who': 'parent'}`, assert
    `factory.created[0].requests.single.uri.toString()` equals `'http://127.0.0.1:31415/v1/health'`,
    and assert `factory.created[0].requests.single.headers['Authorization']` equals `'Bearer secret'`.
    The candidate completing while the parent is parked is the interference proof; two mock adapters
    answering instantly would prove nothing. Add `import 'dart:async';` to the file.
  - `'should leave the parent base URL unchanged when a candidate is built'` — after building the
    candidate, `await parent.dio.get<dynamic>('/v1/health')`; assert the parent's request URI is
    `'http://127.0.0.1:31415/v1/health'`.

Add `import 'package:kanthord/api/daemon_endpoint.dart';` to the file.

**Action — GREEN:** the software-engineer's Task 005.3 creates the seam.

### Task 005.3 — the client

**Input:** `lib/api/kanthord_api.dart`

**Action — GREEN:** write the file exactly as the `## Change` section states.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/api/kanthord_api_test.dart` exits 0.
- `make test` exits 0 — Task 005.1 edits `test/api/dio_mock_adapter.dart`, which every SDK test
  imports, so the whole suite is the regression guard for that Task, not one file.
- `make arch-check` exits 0 — `lib/api/` imports no `features/`, `app/`, `libraries/` and no
  `package:flutter/`.
- `make verify` exits 0.
- Proof: `PASS 001.1-G7-CANDIDATE`, `PASS 001.1-G9-MECHANICAL`.
- NEEDS-HUMAN: none. Nothing in this Story composes the client into a screen, and
  `lib/app/kanthord_app.dart` still shows `KDGalleryPage`, so no Chrome run proves anything here. The
  browser proof stays with EPIC 003.
