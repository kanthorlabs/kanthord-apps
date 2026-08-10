# EPIC 001 — Transport foundation — stories

Epic: `.agent/plan/epics/001-transport-foundation.md`
Prereq: none. It is the first EPIC of the set. `.agent/plan/epics/000-api-integration-overview.md` is
a map and holds no gate.

After these ten Stories, `lib/api/` exists and answers `api.system.health()` and `api.system.db()`
through one `Dio` that reads the base URL per request and attaches the bearer token.

## Dispatch order

Take the files in number order, `01` through `10`. The order is a compile order, so no Story
references a symbol a later Story creates.

- **`01` is applied and needs no `/work` Task.** `scripts/lane-check.sh:45` denies `Makefile` to
  every role, so the human applied it before dispatch. `make test-one T=<path>` now runs, which is
  what the eight `make test-one` lines of the EPIC `Proof:` block need. Dispatch starts at `02`.
- `03` and `04` are a coupled pair. `04` replaces one message inside the function `03` writes, and
  both deliver `PASS 001-G3-ERRORS`.
- `07`, `08` and `09` are a coupled chain. The models are typed by the open enum, and the resource
  decodes the models.

The file order and the EPIC `## Stories` order are the same. The EPIC bullet order was corrected to
this compile order at authoring time, for two reasons it now states itself: `Health.status` is typed
by the open enum, and `api.system` returns a `SystemResource`.

## Stories

- `01` — the `Makefile` target every later Proof uses → `01-make-test-one.md`
- `02` — `BaseUrlProviderType`, `ApiConfig` and `BaseUrlInterceptor` → `02-api-config-and-base-url-provider.md`
- `03` — the sealed hierarchy and the envelope decoder → `03-api-exception.md`
- `04` — the web-opaque no-network message → `04-web-opaque-failure-message.md`
- `05` — `TokenProviderType`, the interface alone → `05-token-provider.md`
- `06` — `AuthInterceptor`, the four rules of `docs/api/auth.md` → `06-auth-interceptor.md`
- `07` — `WireEnum` plus the two `system` converters → `07-open-enum.md`
- `08` — `Health`, `HealthDependency`, `DbStatus`, `Migration` → `08-system-models.md`
- `09` — `SystemResource.health()` and `.db()` → `09-system-resource.md`
- `10` — `KanthordApi` and the barrel → `10-kanthord-api.md`

## Facts (needed for implementation)

- **`lib/api/` does not exist.** Every file in these Stories is new. `lib/` holds `app/`,
  `libraries/kd_design_system/` and `main.dart` only.
- **The contract lives at `docs/api/contract/`.** The EPIC named `contract/features/system.yaml` and
  `contract/examples/system.health.json`, and both paths were corrected in the EPIC at authoring
  time. `.prettierignore:13` excludes that tree, so it is byte-stable.
- **`docs/api/contract/examples/system.health.json` holds two keys**, `success` and `error`. The
  resource test decodes `success` for the 200 case and `error` for the 503 case. The same shape
  applies to `system.db.json`.
- **`pubspec.yaml:20` is `version: 1.0.0+1`.** `ApiConfig.clientVersion` is `'1.0.0+1'`, the whole
  `version` field, because the EPIC says the constant is asserted equal to that field and no document
  authorizes dropping the build number. `test/api/api_config_test.dart` reads the file and asserts
  the whole value.
- **`scripts/arch-check.sh:64` bans a comment in hand-written Dart under `lib/api/`.** A comment
  fails the software-engineer's handoff gate.
- **`scripts/arch-check.sh:52-70` already implements the four greps of G8.** G8 needs no new script,
  only a `make arch-check` that stays green over the new tree.
- **`make test-one T=<path>` exists.** It sits at `Makefile:114`, between `test:` and `arch-check:`,
  and it was verified against an existing design-system test.
- **`build.yaml:8-19`** runs `freezed` over `lib/api/models/**.dart` and `json_serializable` over the
  same path with `explicit_to_json: true`, `create_to_json: true`, `include_if_null: false`. A model
  outside `lib/api/models/` generates nothing.
- **`freezed` 3.2.5 requires `abstract class` or `sealed class`** on a `@freezed` declaration.
- **No `http_mock_adapter` dependency exists**, and `pubspec.yaml` is locked to both roles. Story 02
  Task 002.1 writes `test/api/dio_mock_adapter.dart`, a hand-written `HttpClientAdapter`, and every
  later SDK test imports it.
- **`dio.options.baseUrl` is a plain field**, so a base URL captured at construction cannot change per
  request. `BaseUrlInterceptor.onRequest` sets `options.baseUrl` instead, and `RequestOptions.uri` is
  computed after the interceptor chain runs.
- **An interceptor cannot throw an `ApiException` to the caller.** Dio wraps whatever an interceptor
  rejects into a `DioException`. `AuthInterceptor` therefore rejects with a `DioException` whose
  `error` field holds the `ApiUnauthorizedException`, and `ApiException.fromDio` returns that instance
  unchanged as its first rule.
- **`lib/api/` imports no `package:flutter/`**, so `kIsWeb` is unavailable, and `dart:io` breaks the
  web build. `lib/api/api_platform.dart` declares
  `const bool kApiIsWeb = bool.fromEnvironment('dart.library.js_interop');`, a compile-time constant
  that needs no import.
- **`test/**` mirrors `lib/**` with one exception.** The `BaseUrlInterceptor` test lives at
  `test/api/base_url_provider_test.dart`, because the EPIC Proof names that path and the Proof is
  binding.
- **`MockHttpClientAdapter.respond` carries a default** of `200 {}`, so a test that only inspects the
  recorded request assigns nothing and no test throws a `LateInitializationError`. A test that
  asserts a decoded model or an error assigns `adapter.respond` before it acts.
- **No Chrome run proves anything in this EPIC.** `lib/app/kanthord_app.dart` shows `KDGalleryPage`,
  nothing composes `KanthordApi`, and an unreferenced library may not reach the web bundle. The web
  proof is deferred to EPIC 003, the first slice a human can run. Stories `04` and `10` record the
  deferral.
- **`make generate` is forbidden to both roles.** The software-engineer runs `make generate-lib`, the
  test-engineer runs `make generate-test`, and the generated files are committed.
