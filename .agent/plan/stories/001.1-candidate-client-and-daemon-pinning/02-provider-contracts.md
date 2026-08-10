# Story 02 — the two provider contracts

Epic: `.agent/plan/epics/001.1-candidate-client-and-daemon-pinning.md`
Depends on: Story 01 (`DaemonEndpoint`, `kCandidateDaemonId`).

## Change

- `lib/api/base_url_provider.dart:1-3` — replace the whole file:

  ```dart
  import 'daemon_endpoint.dart';

  abstract class BaseUrlProviderType {
    Future<String> baseUrl();
    Future<DaemonEndpoint?> endpoint();
  }

  final class StaticBaseUrlProvider implements BaseUrlProviderType {
    const StaticBaseUrlProvider(this._endpoint);

    final DaemonEndpoint _endpoint;

    @override
    Future<String> baseUrl() async => _endpoint.baseUrl;

    @override
    Future<DaemonEndpoint?> endpoint() async => _endpoint;
  }
  ```

- `lib/api/token_provider.dart:1-5` — replace the whole file:

  ```dart
  abstract class TokenProviderType {
    Future<String?> token();
    Future<String?> tokenOf(String daemonId);
    Future<void> save(String token);
    Future<void> clear();
  }

  final class StaticTokenProvider implements TokenProviderType {
    const StaticTokenProvider(this._token);

    final String _token;

    @override
    Future<String?> token() async => _token;

    @override
    Future<String?> tokenOf(String daemonId) async => _token;

    @override
    Future<void> save(String token) async {}

    @override
    Future<void> clear() async {}
  }
  ```

- `lib/api/api_config.dart:23` — add one method after `Future<String> baseUrl() => ...`:

  ```dart
  Future<DaemonEndpoint?> endpoint() => _baseUrlProvider.endpoint();
  ```

  and add `import 'daemon_endpoint.dart';` after `import 'base_url_provider.dart';` at
  `lib/api/api_config.dart:1`.

## Constraints

- `baseUrl()` keeps its EPIC 001 contract. Do not delete it, do not narrow it, do not make it
  derive from `endpoint()`.
- Both members of `BaseUrlProviderType` are abstract. No default implementation, no mixin.
- `StaticTokenProvider.tokenOf` returns the one static token for **every** id. It does not compare
  the id to `kCandidateDaemonId`.
- `StaticTokenProvider.save` and `.clear` are no-ops. They throw nothing.
- A `null` from `endpoint()` is a normal state. Neither provider file throws.
- No selection logic, no registry, no storage read. EPIC 002 owns those.
- No comment in either file. `scripts/arch-check.sh:82`.

## Tasks

### Task 002.1 — keep the suite compiling

**Input:** `test/api/api_config_test.dart`, `test/api/base_url_provider_test.dart`,
`test/api/kanthord_api_test.dart`, `test/api/resources/system_resource_test.dart`,
`test/api/token_provider_test.dart`, `test/api/interceptors/auth_interceptor_test.dart`

**Action — RED:** the two interfaces gain a member each, so every hand-written stub and the
generated mock stop compiling. Repair each site, and change nothing else in these files:

- `test/api/api_config_test.dart:7-13` `_StubBaseUrlProvider` — add
  `Future<DaemonEndpoint?> endpoint() async => DaemonEndpoint(id: 'stub', name: 'stub', baseUrl: value);`
  and `import 'package:kanthord/api/daemon_endpoint.dart';`.
- `test/api/base_url_provider_test.dart:9-16` `_StubBaseUrlProvider` and `:18-25`
  `_MutableBaseUrlProvider` — the same `endpoint()` body over `value`, same import.
- `test/api/kanthord_api_test.dart:15-22` `_StubBaseUrlProvider` and `:24-31`
  `_MutableBaseUrlProvider` — the same `endpoint()` body over `value`, same import.
- `test/api/kanthord_api_test.dart:33-44` `_StubTokenProvider` — add
  `Future<String?> tokenOf(String daemonId) async => 'secret';`.
- `test/api/resources/system_resource_test.dart:15-21` `_StubBaseUrlProvider` — add
  `Future<DaemonEndpoint?> endpoint() async => const DaemonEndpoint(id: 'stub', name: 'stub', baseUrl: 'http://127.0.0.1:31415');`
  and the import.
- `test/api/token_provider_test.dart:4-19` `_RecordingTokenProvider` — add
  `Future<String?> tokenOf(String daemonId) async => _value;`.
- `test/api/interceptors/auth_interceptor_test.dart` — no edit, and **no codegen in this Task**.
  `mockito` reads the interface as it stands on disk, so a `make generate-test` run before Task 002.3
  edits `lib/api/token_provider.dart` regenerates the mock **without** `tokenOf` and leaves it stale.
  Task 002.4 owns the regeneration.

Every stub `endpoint()` returns a non-null `DaemonEndpoint`, because Story 04 makes
`BaseUrlInterceptor` reject a `null` one and these suites must stay green.

**Action — GREEN:** the software-engineer's Task 002.3 creates the seam.

### Task 002.2 — the two contracts and the two static implementations

**Input:** `test/api/base_url_provider_test.dart`, `test/api/token_provider_test.dart`

**Action — RED:** add one new top-level group to each file, above the group already there.

In `test/api/base_url_provider_test.dart`, group `StaticBaseUrlProvider`:

- Nested group `endpoint`:
  - `'should return the endpoint it holds when it is read'` — construct
    `StaticBaseUrlProvider(DaemonEndpoint(id: 'a', name: 'local', baseUrl: 'http://127.0.0.1:31415'))`;
    assert `await provider.endpoint()` equals that same `DaemonEndpoint`.
  - `'should return the same endpoint when it is read twice'` — assert two reads are equal.
- Nested group `baseUrl`:
  - `'should return the base URL of the endpoint it holds when it is read'` — assert
    `await provider.baseUrl()` equals `'http://127.0.0.1:31415'`.

Add a private stub in the same file, `_UnselectedBaseUrlProvider implements BaseUrlProviderType`,
whose `endpoint()` answers `null` and whose `baseUrl()` answers `''`, and group
`BaseUrlProviderType`:

- Nested group `endpoint`:
  - `'should return null when no daemon is selected'` — assert `await provider.endpoint()` is
    `isNull`, and assert the call throws nothing.

In `test/api/token_provider_test.dart`, group `StaticTokenProvider`:

- Nested group `tokenOf`:
  - `'should return the static token when any daemon id is asked'` — construct
    `StaticTokenProvider('secret')`; assert `await provider.tokenOf(kCandidateDaemonId)` and
    `await provider.tokenOf('some-other-id')` both equal `'secret'`.
- Nested group `token`:
  - `'should return the static token when it is read'` — assert `await provider.token()` equals
    `'secret'`.
- Nested group `save`:
  - `'should keep the static token when save is called'` — `await provider.save('other')`; assert
    `await provider.token()` still equals `'secret'`.
- Nested group `clear`:
  - `'should keep the static token when clear is called'` — `await provider.clear()`; assert
    `await provider.token()` still equals `'secret'`.

Extend the existing `TokenProviderType` group with a nested group `tokenOf`:

- `'should return the saved token for every id when one token is stored'` — over
  `_RecordingTokenProvider`, `await provider.save('secret')`; assert `await provider.tokenOf('a')`
  equals `'secret'`.

**Action — GREEN:** the software-engineer's Task 002.3 creates the seam.

### Task 002.3 — the interfaces, the static implementations and the config method

**Input:** `lib/api/base_url_provider.dart`, `lib/api/token_provider.dart`, `lib/api/api_config.dart`

**Action — GREEN:** write the three edits exactly as the `## Change` section states.

**Action — REFACTOR:** none.

### Task 002.4 — regenerate the token provider mock

**Input:** `test/api/interceptors/auth_interceptor_test.mocks.dart`

**Action — RED:** this Task runs **after** Task 002.3, because `mockito` generates against the
interface on disk. Run `make generate-test`, so
`test/api/interceptors/auth_interceptor_test.mocks.dart` gains a `tokenOf` override.
`MockTokenProviderType` cannot compile without it once `TokenProviderType` declares the member.
`make generate` is forbidden. Assert the regenerated file declares `tokenOf`, then confirm GREEN over
the whole `## Verify` list below.

**Action — GREEN:** none. This Task changes no production code.

## Verify

- `make test-one T=test/api/base_url_provider_test.dart` exits 0.
- `make test-one T=test/api/token_provider_test.dart` exits 0.
- `make test-one T=test/api/api_config_test.dart` exits 0 — the EPIC 001 regression guard.
- `make test-one T=test/api/resources/system_resource_test.dart` exits 0 — the EPIC 001 regression
  guard.
- `make test-one T=test/api/interceptors/auth_interceptor_test.dart` exits 0 against the regenerated
  mock.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: `PASS 001.1-G2-PROVIDER`, `PASS 001.1-G3-TOKENS`.
