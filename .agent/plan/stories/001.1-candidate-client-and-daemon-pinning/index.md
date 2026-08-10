# EPIC 001.1 — the candidate client and daemon pinning — stories

Epic: `.agent/plan/epics/001.1-candidate-client-and-daemon-pinning.md`
Prereq: EPIC 001 (sequence order). `lib/api/` exists and answers `api.system.health()`.

After these six Stories, one request resolves one daemon one time, the token it sends belongs to that
daemon, and `api.withCandidate(baseUrl:, token:)` returns a throwaway client EPIC 003 probes with.

## Dispatch order

Take the files in number order, `01` through `06`. The order is a compile order, so no Story
references a symbol a later Story creates.

- `01` is the root. `kDaemonIdKey` and `kCandidateDaemonId` come from it, and `02`, `04` and `05` all
  import it.
- `02` is the widest Story of the set, because two interfaces gain a member each and that breaks
  every hand-written stub in `test/api/` plus the generated `TokenProviderType` mock. Its four Tasks
  run in number order and the order is load-bearing: `002.1` repairs the stubs and `002.2` adds the
  new coverage (test-engineer), `002.3` writes the interfaces (software-engineer), and **`002.4`
  regenerates the mock last** (test-engineer). `mockito` reads the interface from disk, so a
  `make generate-test` before `002.3` writes a mock without `tokenOf` and leaves it stale.
- `03` is independent of `01` and `02`. It sits third only because `04` rejects with the exception it
  adds.
- `04` and `05` are the two behavior Stories. `04` pins the id and scopes the token read, `05` builds
  the candidate over the static providers `02` wrote.
- `05` starts by extending the shared `test/api/dio_mock_adapter.dart` (Task 005.1), so its
  regression guard is `make test`, not one file.
- `06` is documentation and holds no test.

## Decisions

The EPIC leaves these four open. The owner ruled on 2026-08-10 and they are settled. Do not re-open
one at build time.

- **`kCandidateDaemonId` is `'kanthord.candidate'`.** Story 01.
- **The candidate `DaemonEndpoint.name` is `'candidate'`.** Story 05. The SDK never reads it and
  nothing displays it.
- **A valid pin is a `String` value at `options.extra[kDaemonIdKey]`.** Story 04. A non-`String` is
  not a pin, so `BaseUrlInterceptor` overwrites it. `AuthInterceptor` therefore never falls back to the
  unscoped token on a malformed pin, and it grows no malformed branch of its own.
- **`BaseUrlInterceptor` preserves an existing pin, and the guard lives in this EPIC.** Story 04.
  `Dio.fetch` re-runs the request interceptor chain, so without the early return the retry invariant of
  the EPIC is not true and the Story 06 README documents a guarantee the code does not hold. It is one
  branch, not retry logic, so EPIC 005 inherits a working invariant instead of owning it.

## Stories

- `01` — `DaemonEndpoint`, `kDaemonIdKey`, `kCandidateDaemonId` → `01-daemon-endpoint.md`
- `02` — `endpoint()`, `tokenOf(id)`, `StaticBaseUrlProvider`, `StaticTokenProvider` →
  `02-provider-contracts.md`
- `03` — `ApiNotConfiguredException` → `03-api-not-configured-exception.md`
- `04` — `BaseUrlInterceptor` writes the id, `AuthInterceptor` reads it → `04-pinning-interceptors.md`
- `05` — `withCandidate` and `adapterFactory` → `05-candidate-and-adapter-factory.md`
- `06` — the SDK README → `06-api-readme.md`

## Facts (needed for implementation)

- **EPIC 001 is under implementation and its files exist.** `lib/api/base_url_provider.dart:1-3`,
  `lib/api/token_provider.dart:1-5`, `lib/api/api_config.dart:23`,
  `lib/api/interceptors/base_url_interceptor.dart:12`,
  `lib/api/interceptors/auth_interceptor.dart:13`, `lib/api/api_exception.dart:119-121` and
  `lib/api/kanthord_api.dart:10-24` are the exact edit sites. Every Story quotes the current code it
  replaces.
- **`build.yaml:8-19` runs `freezed` over `lib/api/models/**` only.** `lib/api/daemon_endpoint.dart`
  sits outside that path, so `DaemonEndpoint` hand-writes `==` and `hashCode`. It is not `@freezed`.
- **Adding a member to `BaseUrlProviderType` breaks six test files.** The stubs are at
  `test/api/api_config_test.dart:7`, `test/api/base_url_provider_test.dart:9` and `:18`,
  `test/api/kanthord_api_test.dart:15`, `:24` and `:33`, and
  `test/api/resources/system_resource_test.dart:15`. The `TokenProviderType` stub is at
  `test/api/token_provider_test.dart:4`. Story 02 Task 002.1 repairs all of them in one turn.
- **`test/api/interceptors/auth_interceptor_test.mocks.dart` must be regenerated, and only after the
  interface changes.** The `@GenerateMocks([TokenProviderType])` annotation is at
  `test/api/interceptors/auth_interceptor_test.dart:12`. The test-engineer runs `make generate-test` in
  Story 02 Task 002.4, after Task 002.3 adds `tokenOf`. `make generate` is forbidden to both roles.
- **Every stub `endpoint()` in an EPIC 001 test returns a non-null `DaemonEndpoint`.** Story 04 makes
  `BaseUrlInterceptor` reject a `null` one, so a stub that answers `null` turns an EPIC 001 suite red.
- **The `BaseUrlInterceptor` test moves.** EPIC 001 put it at `test/api/base_url_provider_test.dart`
  because that EPIC's Proof named the path. The EPIC 001.1 Proof names both
  `test/api/base_url_provider_test.dart` and `test/api/interceptors/base_url_interceptor_test.dart`,
  so Story 04 Task 004.1 moves the interceptor group to the mirror path and leaves the provider
  contract behind. Both Proof lines stay satisfied and `test/**` mirrors `lib/**` again.
- **An interceptor cannot throw an `ApiException` to the caller.** Dio wraps whatever an interceptor
  rejects into a `DioException`. `BaseUrlInterceptor` therefore rejects with a `DioException` whose
  `error` field holds the `ApiNotConfiguredException`, and `ApiException.fromDio` rule 1
  (`lib/api/api_exception.dart:9-12`) returns that instance unchanged. So `fromDio` **does** return
  the exception on the carried path; what it never does is construct one from a daemon answer, which
  is the G6 rule Story 03 asserts.
- **`withCandidate` is an instance method.** EPIC 003 G3 calls `api.withCandidate(baseUrl:, token:)`
  on the registered client, and G8 requires the parent's `adapterFactory` to travel to the candidate.
  A static factory could do neither.
- **`options.extra` is a plain `Map<String, dynamic>` on `RequestOptions`.** It survives the
  interceptor chain and it is readable on the recorded request in `MockHttpClientAdapter.requests`,
  which is how the pinning assertions read the id.
- **`MockHttpClientAdapter` is at `test/api/dio_mock_adapter.dart`** and its `close` is a no-op today,
  so a candidate close test over it would prove nothing. Story 05 Task 005.1 gives the adapter a
  `closeCalls` counter and a `hold` future first, so the close test asserts the parent adapter was not
  closed and the concurrency test parks one response and proves the other completes meanwhile.
- **`Dio.close` is observable without the mock too.** `dio-5.11.0/lib/src/dio_mixin.dart:57` sets a
  private `_closed` flag and calls `httpClientAdapter.close`, and `:407` makes a later request throw
  `DioException.connectionError`. So "the candidate is closed and the parent still works" is a real
  assertion pair, not a tautology.
- **`Dio.fetch(requestOptions)` re-runs the request interceptor chain**
  (`dio-5.11.0/lib/src/dio_mixin.dart:418`). That is how EPIC 005 will retry, and it is why
  `BaseUrlInterceptor` must return early on an existing pin instead of resolving again.
- **`scripts/arch-check.sh:82` bans a comment in hand-written Dart under `lib/api/`.** A comment
  fails the software-engineer handoff gate. `lib/api/README.md` is markdown and is not scanned.
- **`lib/api/README.md` is prettier-checked.** `.prettierignore` does not exclude `lib/`, and
  `make verify` runs `make format-check`, so Story 06 runs `make format` and keeps the result.
- **`scripts/lane-check.sh:44` denies `CLAUDE.md` to every role.** Its note that `lib/api/README.md`
  "does not exist yet" is the human's to remove after Story 06.
- **No Chrome run proves anything in this EPIC.** `lib/app/kanthord_app.dart` still shows
  `KDGalleryPage` and nothing composes `KanthordApi`. The browser proof stays with EPIC 003.
