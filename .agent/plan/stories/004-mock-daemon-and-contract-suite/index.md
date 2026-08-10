# EPIC 004 — The mock daemon and the contract suite — stories

Epic: `.agent/plan/epics/004-mock-daemon-and-contract-suite.md`
Prereq: EPIC 001 (sequence order), plus EPIC 002 Story 03 for Story 11 alone.
`.agent/plan/epics/000-api-integration-overview.md:41-49` records both, and says 004 may start as
soon as 001 lands and runs beside 002 and 003.

After these eleven Stories, `test/mock_daemon/` serves the published contract over loopback HTTP,
`test/api/contract/` asserts four things per operation against it on every `make test`, and three
release-safety guards hold.

## Three review findings, all resolved

Review raised three items and the owner closed each one. Nothing here blocks dispatch. The record
stays so nobody re-opens a settled question.

- **The EPIC 002 dependency — resolved by declaring it.** Story 11's composition-root guard needs
  `lib/app/injection.dart` from EPIC 002 Story 03, and no rearrangement removes that need — a
  composition-root assertion requires a composition root. So the dependency is now stated where it
  belongs rather than worked around: `000-api-integration-overview.md` records `001, 002.3` for this
  EPIC and explains that `002.3` is one Story, and `004-mock-daemon-and-contract-suite.md` repeats it
  under its title and in G7. Stories 01 through 10 stay independent of EPIC 002.
- **The provenance wording — resolved as literal byte equality, no amendment.** The EPIC Proof says
  every fixture is "byte-equal to the matching key", and that holds exactly. It was measured on all
  four fixtures before dispatch: Dart's `JsonEncoder.withIndent('  ')` plus one newline, Node's
  `JSON.stringify(value, null, 2)` plus one newline, and `prettier --check` all produce the same
  bytes. `.prettierignore` does not exclude the fixture tree, so `make format-check` holds it on that
  form. Story 03 pins the generator, Story 11 asserts the bytes.
- **The narrower scenario set — resolved as deferred, recorded in `HANDOFF.md`.**
  `docs/api/parallel-development.md:98-107` asks for a node in every state with each of the five
  block reasons, a waived edge, and a large graph. EPIC 004 builds one `blocked-node` scenario and
  neither of the other two. All three are cheap today — the mock serves raw JSON and decodes nothing,
  so none needs a model — but nothing consumes them while `lib/features/` is empty. `HANDOFF.md`
  section 4b now carries them, to be built with the screen that reads them. Do not build them here.

## Dispatch order

Take the files in number order, `01` through `11`. The order is a build order: each Story extends
`test/mock_daemon/mock_daemon.dart` at a named site that the previous Story created.

- `02`, `03` and `04` are a coupled triple. All three write
  `test/mock_daemon/contract_enforcement_test.dart`, and `04` delivers
  `PASS 004-G2-ENFORCEMENT` for all three.
- `05` and `06` are a coupled pair. Both write `test/mock_daemon/cursor_test.dart`, and `06`
  delivers `PASS 004-G3-CURSOR`.
- `08` and `09` are a coupled pair. Both write `test/api/contract/contract_case.dart`, and `09`
  delivers `PASS 004-G5-SUITE`.
- `06` is a **characterization Story, not a RED/GREEN cycle**. `applyCursor` already satisfies every
  case it asserts. `/work` runs it as a test-only Task with no software-engineer turn, and the ready
  marker must say so rather than claim a RED phase.
- **`11` blocks on EPIC 002 Story 03.** Its composition-root guard imports
  `package:kanthord/app/injection.dart`, `configureDependencies` and `getIt`, and none of them
  exists until that Story lands. Dispatch `01` through `10` at any time after EPIC 001. Dispatch
  `11` only after EPIC 002 Story 03 is green. If EPIC 002 is still open when `10` finishes, stop and
  report the block — do not stub the composition root and do not weaken the guard.

The file order differs from the EPIC `## Stories` bullet order in one place, and the change is a
build order, not a scope change. The EPIC lists routing, then the bearer rule, then the envelope
writer. Routing and the bearer rule both write their answers through the envelope writer, so the
envelope writer is `02` and the other two follow.

**Every Story in this EPIC is the test-engineer lane, and no Story writes a line under `lib/`.**
The mock daemon, the fixtures, the scenarios, the suite and the three guards all live under
`test/`, which `scripts/lane-check.sh:77-80` assigns to the test-engineer. There is no
software-engineer Task in this EPIC. Each Story states the RED and the GREEN action for the same
role.

## Stories

- `01` — `MockDaemon` binds `127.0.0.1:0`, reports its port, records requests → `01-mock-daemon-server.md`
- `02` — `writeError`, `writeJson` and the 22-code status map → `02-envelope-writer.md`
- `03` — the 54-row routing table, the parameter kind rule, the fixture store → `03-routing-table.md`
- `04` — the bearer rule, checked before routing → `04-bearer-rule.md`
- `05` — the strict cursor schema and the paging rule → `05-cursor.md`
- `06` — the three absent-id cursor cases → `06-absent-id-cursor.md`
- `07` — 28 scenario directories and the four behaviors → `07-scenarios.md`
- `08` — the four-part contract case, the two rows, the asserted count → `08-contract-suite-harness.md`
- `09` — the wire-name assertion against the published schema → `09-wire-name-rule.md`
- `10` — the live lane, configured by two environment variables, never skipped → `10-live-lane.md`
- `11` — fixture provenance, fixture location, the composition root → `11-release-safety-guards.md`

## Facts (needed for implementation)

- **EPIC 001 is mid-flight, so check the tree before you trust this list.** At authoring time
  `lib/api/` held `api_config.dart`, `base_url_provider.dart` and `interceptors/base_url_interceptor.dart`,
  and `test/api/` held three tests plus `dio_mock_adapter.dart`. `KanthordApi`, `SystemResource`, the
  four models and the `lib/api/api.dart` barrel are **not** written yet, and Stories 08 through 11
  need all of them. `test/mock_daemon/` and `test/app/` do not exist. Every file in these Stories is
  new, except the four that Stories 02 through 07 extend in place.
- **`test/api/dio_mock_adapter.dart` is not this EPIC's seam.** EPIC 001 uses it to test a resource
  method against a stubbed adapter. The contract suite deliberately does the opposite: a real `Dio`
  over real loopback HTTP. Do not import the mock adapter anywhere under `test/api/contract/` or
  `test/mock_daemon/`.
- **`pubspec.yaml` is denied to every role** by `scripts/lane-check.sh:41`. The mock daemon therefore
  uses `dart:io` `HttpServer`, which needs no dependency. There is no `shelf`, no `http` and no
  `http_mock_adapter` in the tree.
- **No YAML parser exists.** `yaml` is absent from `pubspec.yaml`, so Story 09 transcribes the
  required-field sets from `docs/api/contract/features/system.yaml` and records the line numbers as
  provenance. Every other contract fact is read from JSON or parsed out of Markdown at run time.
- **`docs/api/contract/examples/<op>.json` holds up to four keys** — `query`, `request`, `success`
  and `error`, in that order. `error` is the complete double-wrapped envelope,
  `{"error":{"code":…,"message":…}}`, so it can be served verbatim. Only `event.list.json` carries a
  `query` key.
- **A list response is one object with one plural array.** There is no `nextCursor`, no `hasMore` and
  no `total` in any example. A short page means the end. `docs/api/conventions.md:114-123`.
- **`docs/api/operations.md` declares 54 operations: 24 `routed` and 30 `stubbed`.** 23 carry a
  schema, and the one routed operation without a schema is `blob.show`. The routing table holds all
  54, because a `stubbed` path answers `501` on the real daemon and only a path absent from the
  table answers `404`. `docs/api/operations.md:11-13`.
- **The path dialect differs by source.** `docs/api/operations.md` writes `:id` and `:hash`;
  `docs/api/contract/features/*.yaml` writes `{id}` and `{hash}`. `routes.dart` uses the colon form,
  because Story 03 parses `operations.md` to pin the table.
- **`event.list` is the only operation that declares query parameters**, seven of them, at
  `docs/api/contract/features/event.yaml:12-53`. `node.list` has five filters in prose at
  `docs/api/operations.md:147` and declares none in `node.yaml:8-23`. The mock follows the schema, so
  every route except `event.list` declares the empty key set and rejects any query key.
- **The cursor schema is `src/http/contract/cursor.ts`**, quoted at
  `docs/api/conventions.md:75-92`: strict object, `after` optional with `min(1)`, `limit` coerced to
  an integer, default `100`, bounds `1..500`.
- **`limit` is coerced, not integer-parsed.** `z.coerce.number().int()` runs JavaScript `Number()`
  first, so `limit=1.0` and `limit=1e2` are legal and mean `1` and `100`. `int.tryParse` rejects
  both and would make the mock stricter than the daemon. Story 05 uses `coerceLimit`, built on
  `double.tryParse` plus an integrality check. Its one known divergence is a hexadecimal literal.
- **The mock accepts the five event filters and applies none of them.** It pages a fixture list and
  runs no query engine. No test may assert that a filter narrowed a result.
- **The daemon pipeline order is fixed and tabulated** in `07-scenarios.md`, under
  `## The pipeline order`. Read it before adding any behavior to `_handle`. The body drain precedes
  the bearer check, so "the bearer check is first" always means first inside `_handle`.
- **`test/mock_daemon/http_probe.dart` is the only way a test speaks HTTP.** Story 01 writes it. No
  test builds an `HttpClient` inline. `probe` drains the body; `openProbe` returns the undrained
  response, which the truncated assertions need.
- **Every Dart snippet in these Stories omits `// Arrange`, `// Act` and `// Assert`.** Add all three
  to every test body. `docs/testing.md:18-19` allows those three comments and no others.
- **`after` is an exclusive lower bound, not a row reference.** `WHERE id > ?` with
  `ORDER BY id ASC`, and the daemon never checks that the string names a real row.
  `docs/api/conventions.md:94-112`.
- **`docs/api/errors.md:27-50` holds 22 codes.** `service-unavailable` is `503`. The set is open for
  a decoding client and closed for the mock, which throws on a code it cannot map.
- **`dart:io` lower-cases every received header name.** The request-serialization assertion compares
  against `'authorization'` and `ApiConfig.clientHeader.toLowerCase()`.
- **`ApiConfig.clientHeader` is `'X-Kanthord-Client'` and `ApiConfig.clientVersion` is `'1.0.0+1'`**,
  from `.agent/plan/stories/001-transport-foundation/02-api-config-and-base-url-provider.md:31-32`.
- **`KanthordApi({required ApiConfig config, required TokenProviderType tokens, Dio? dio})**, from
EPIC 001 Story 10. `BaseUrlProviderType`declares`Future<String> baseUrl()`, and
`TokenProviderType`declares`token()`, `save()`and`clear()`.
- **`analysis_options.yaml:5-6` sets `strict-casts` and `strict-raw-types`.** `jsonDecode` returns
  `dynamic`, so every use needs an explicit cast, and no bare `Map`, `List` or `Future` annotation
  passes. `test/**` is analyzed under the same lints. `analysis_options.yaml:16` sets the formatter
  page width to 100.
- **`// Arrange`, `// Act` and `// Assert` are the only comments allowed in a test.**
  `docs/testing.md:16-19` also fixes the name form, `'should <expected behavior> when <condition>'`,
  and the group form, class then method.
- **`scripts/arch-check.sh` scans `lib` only**, from `scripts/arch-check.sh:11-19`. No rule in it
  reaches `test/`, so `dart:io`, `HttpServer` and the three test comments are all legal here.
- **`build.yaml:31-33` runs `mockito` over `test/**.dart`.** No Story in this EPIC uses
  `@GenerateMocks`, so no Story runs `make generate-test`. The suite mocks nothing: it drives a real
  `Dio` against a real loopback server.
- **`make test-one T=<path>` accepts a directory.** `Makefile:113-114` passes `$(T)` straight to
  `flutter test`, and `flutter test` collects `*_test.dart` only, so the helper files
  `contract_case.dart`, `routes.dart`, `cursor.dart`, `fixtures.dart`, `scenarios.dart` and
  `error_envelope.dart` are never collected as suites.
- **`make verify` is `format-check analyze arch-check test pipeline-test`**, `Makefile:125`. It sets
  no live environment variable, so the live lane always runs its not-configured path in the gate.
- **The `lib` must not import `test` guard is already applied.** `scripts/arch-check.sh:74-75` plus
  the two self-test cases at `scripts/arch-check.test.sh:60-63`. Story 11 asserts it stays green and
  writes neither file — `scripts/lane-check.sh:38` denies both to every role.
- **Nothing in this EPIC needs a browser, a simulator or an emulator.** The one `NEEDS-HUMAN:` line
  is in Story 10, and it is a live daemon, not a platform.
