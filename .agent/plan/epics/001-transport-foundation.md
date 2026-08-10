# EPIC 001 — Transport foundation

Status: **ready**.

`lib/api/` does not exist. This epic creates it: configuration, the exception hierarchy, the token
interface, the auth interceptor, one client, and the two operations that have a handler today. It is
a library slice. EPIC 003 is the slice a human can run.

## Goal

- **G1** — `lib/api/api_config.dart` holds the base URL, the connect, send and default receive
  timeout, a per-operation receive timeout override, and the `X-Kanthord-Client` version. It
  hard-codes no host and no port. `http://localhost:31415` is a convention the app layer prefills, and
  the SDK never substitutes it for a missing value.
- **G2** — The base URL is read through `BaseUrlProviderType`, not captured at construction. A
  settings change takes effect on the next request with no re-registration.
- **G3** — `lib/api/api_exception.dart` is a `sealed class` with the seven subclasses of
  `docs/api/errors.md`. It decodes the `{"error":{code,message,details}}` envelope, branches on
  `code`, keeps `details` as a nullable `Map<String, dynamic>`, and maps an unknown code to
  `ApiResponseException` with the raw code kept.
- **G4** — `lib/api/token_provider.dart` declares `TokenProviderType` with `token`, `save` and
  `clear`.
- **G5** — `lib/api/interceptors/auth_interceptor.dart` attaches `Authorization: Bearer <token>`,
  throws `ApiUnauthorizedException` before the request leaves when the token is null or empty, throws
  it again on a `401`, and never clears the stored token.
- **G6** — `lib/api/kanthord_api.dart` takes an optional `Dio`, builds a default one from
  `ApiConfig`, and exposes `api.system`.
- **G7** — `SystemResource.health()` and `SystemResource.db()` return models built from
  `docs/api/contract/features/system.yaml` and decoded from the published examples.
- **G8** — `make arch-check` passes. It proves four greps and no more: no import of `features/`,
  `app/` or `libraries/` from `lib/api/`; no `package:flutter/` import there; no `Stream<` under
  `lib/api/resources/`; no `Either<` and no `Result<`.

## Non-goals

- No retry, no idempotency and no logging interceptor. EPIC 005 owns each.
- No mock daemon. Every test here uses a `Dio` mock adapter. EPIC 004 owns the daemon.
- No model and no method beyond `system.health` and `system.db`. `system.status` carries a schema and
  no handler, so EPIC 006 writes it with the rest of the set.
- No `get_it` registration, no router, no `TokenProviderType` implementation and no
  `BaseUrlProviderType` implementation. EPIC 002 owns each. This epic ships two interfaces.
- No version negotiation. The header is sent and nothing reads the answer. `docs/api/blockers.md` E6.
- No refresh flow, no second `Dio`, no single-flight `Future`. `docs/api/auth.md` deletes each one,
  and `docs/testing.md` now states the four assertions that replace them.

## Verification gate

Gates: `make verify`

`make test-one T=<path>` is a new `Makefile` target this epic adds. It runs `$(FLUTTER) test $(T)`.
`docs/operations.md` requires every command to go through `make`, and a per-goal proof needs a
scoped run.

Proof:

```bash
make test-one T=test/api/api_config_test.dart \
  && echo "PASS 001-G1-CONFIG" \
  && make test-one T=test/api/base_url_provider_test.dart \
  && echo "PASS 001-G2-BASE-URL" \
  && make test-one T=test/api/api_exception_test.dart \
  && echo "PASS 001-G3-ERRORS" \
  && make test-one T=test/api/token_provider_test.dart \
  && echo "PASS 001-G4-TOKEN" \
  && make test-one T=test/api/interceptors/auth_interceptor_test.dart \
  && echo "PASS 001-G5-AUTH" \
  && make test-one T=test/api/kanthord_api_test.dart \
  && echo "PASS 001-G6-CLIENT" \
  && make test-one T=test/api/resources/system_resource_test.dart \
  && echo "PASS 001-G7-SYSTEM" \
  && make arch-check \
  && echo "PASS 001-G8-BOUNDARY" \
  && echo "PASS EPIC-001"
```

Hermetic coverage required beyond the Proof:

- A response body that is not the envelope becomes `ApiDecodeException`, never an unhandled cast.
- Each of the eight baseline codes of `docs/api/errors.md` maps to its declared subclass. A code
  outside the table decodes to `ApiResponseException` and keeps its raw string.
- A `plan-invalid` finding code never becomes an exception. It is data inside `details.findings`.
- A `403 host-forbidden` message names the host the client sent and the daemon config key.
- The base URL provider is read per request. A test changes the value between two calls and asserts
  two different request URLs from one `KanthordApi` instance.

`NEEDS-HUMAN:` a Chrome run. `flutter analyze` does not catch a `dart:io` import that breaks the web
build, and `make verify` boots no browser.

## Stories

The order below is the dispatch order, and it is a compile order: no story references a symbol a
later story creates. `.agent/plan/stories/001-transport-foundation/` numbers the files `01` to `10`
in this same order.

- **`make test-one`** — the `Makefile` target every later proof uses.
- **`BaseUrlProviderType` and `ApiConfig`** — the interface, plus the config that reads it. The
  connect, send and default receive timeout are named constants. `receiveTimeoutFor(operation)`
  returns a longer value for `repository.inspect`, `repository.register` and `plan.import`, and the
  default otherwise. The client version is one constant asserted equal to the `version` field of
  `pubspec.yaml`.
- **`ApiException`** — the sealed hierarchy and the envelope decoder. One entry point maps a
  `DioException` type to `ApiNoNetworkException`, `ApiTimeoutException` or `ApiCancelledException`,
  and maps a response to the envelope branch. `401 unauthenticated` and `501 not-implemented` take
  their own subclasses. Every other envelope becomes `ApiResponseException` carrying `status`,
  `code`, `message` and `details`.
- **The web-opaque failure message** — a browser reports an origin rejection, a host rejection, a dead
  daemon and a DNS failure identically. The collapse applies to `ApiNoNetworkException` alone: a
  readable `401` or `403` keeps its own subclass on every platform. On `kIsWeb` the no-network message
  names all four causes and the two daemon configuration keys. The branch is a constructor argument,
  so one test asserts both messages with no platform switch.
- **`TokenProviderType`** — the interface alone.
- **`AuthInterceptor`** — the four rules of `docs/api/auth.md`. A `401` never clears the stored token,
  and a test asserts the stored value survives.
- **The open enum** — a Dart `enum` cannot keep an unknown wire value. `status` on the roll-up and on
  a dependency uses one shared representation: a `@freezed` value type holding the known case and the
  raw string, with a `JsonConverter` that never throws. This story fixes the representation once, and
  EPIC 006 reuses it for every wire enum. It precedes the models, because they are typed by it.
- **The `system` models** — `Health`, `HealthDependency`, `DbStatus` and `Migration`, each `@freezed`
  plus `@JsonSerializable`, `@JsonKey(name:)` on every field, no `field_rename`. `appliedAt` is a
  nullable epoch-millisecond integer.
- **`SystemResource`** — `health()` on `GET /v1/health` and `db()` on `GET /v1/db/status`. Each test
  asserts the path, the headers and the decoded model, and decodes the `success` key of
  `docs/api/contract/examples/system.health.json` and `docs/api/contract/examples/system.db.json`
  rather than invented bytes.
- **`KanthordApi`** — one `Dio`, built from `ApiConfig` when the caller passes none, with the auth
  interceptor installed and the resource groups exposed as lazily built fields. It follows
  `SystemResource`, because `api.system` returns that class.
