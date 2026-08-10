# Story 11 — the release-safety guards

Epic: `.agent/plan/epics/004-mock-daemon-and-contract-suite.md`
Depends on: Story 07 (the scenario tree), Story 09.
**Depends on EPIC 002 Story 03** — `lib/app/injection.dart`, `configureDependencies` and `getIt`.
The composition-root guard cannot be written before that Story lands. The dependency is declared in
`.agent/plan/epics/000-api-integration-overview.md:41-49` and in the EPIC under its title and in G7.
It is settled, not an open question.

**One Task, the test-engineer lane.**

The EPIC names three guards. The second is **already applied and needs no Task here.**
`scripts/arch-check.sh:74-75` implements the `lib` must not import `test` rule and
`scripts/arch-check.test.sh:60-63` self-tests it in both quote styles. Both files are denied to
every role by `scripts/lane-check.sh:38`, and `.agent/plan/stories/002-app-composition/06-lib-must-not-import-test.md`
records the human application. This Story writes the other two guards and asserts the applied one
stays green through `make verify`, which runs `arch-check` and `pipeline-test`.

## Change

- New `test/app/release_safety_test.dart`:

  ```dart
  import 'dart:convert';
  import 'dart:io';

  import 'package:flutter_secure_storage/flutter_secure_storage.dart';
  import 'package:flutter_test/flutter_test.dart';
  import 'package:kanthord/api/api.dart';
  import 'package:kanthord/app/injection.dart';
  import 'package:kanthord/app/settings/base_url_store.dart';
  import 'package:kanthord/app/theme_mode_controller.dart';
  import 'package:shared_preferences/shared_preferences.dart';

  import '../mock_daemon/fixtures.dart';
  import '../mock_daemon/mock_daemon.dart';
  import '../mock_daemon/scenarios.dart';

  String _canonical(Object? value) => const JsonEncoder.withIndent('  ').convert(value);

  final RegExp _kSimulatedName = RegExp('Mock|Fake|Stub|Simulated');

  void main() {
    TestWidgetsFlutterBinding.ensureInitialized();

    group('the fixture provenance guard', () {
      test('should match the published example byte for byte when a fixture is read', () {
        for (final operation in kDefaultFixtureOperations) {
          final published = jsonDecode(
            File('docs/api/contract/examples/$operation.json').readAsStringSync(),
          ) as Map<String, dynamic>;
          final bytes = File('$kFixtureRoot/$operation.json').readAsStringSync();

          expect(bytes, '${_canonical(published['success'])}\n', reason: operation);
        }
      });

      test('should hold a fixture for every declared operation when the set is read', () {
        for (final operation in kDefaultFixtureOperations) {
          expect(loadFixture(operation), isNotNull, reason: operation);
        }
      });

      test('should declare a parent example when every scenario is read', () {
        for (final name in scenarioNames()) {
          final scenario = loadScenario(name)!;

          expect(
            File('docs/api/contract/examples/${scenario.parent}.json').existsSync(),
            isTrue,
            reason: '$name declares the parent ${scenario.parent}',
          );
        }
      });

      test('should derive every overlay from its parent operation when a scenario is read', () {
        for (final name in scenarioNames()) {
          final scenario = loadScenario(name)!;
          final overlays = Directory('$kScenarioRoot/$name')
              .listSync()
              .whereType<File>()
              .map((file) => file.uri.pathSegments.last)
              .where((file) => file != 'scenario.json')
              .toList();

          for (final overlay in overlays) {
            expect(
              overlay,
              '${scenario.parent}.json',
              reason: '$name overlays an operation it does not declare as its parent',
            );
          }
        }
      });

      test('should change only the id when the populated scenario is read', () {
        final parent = (loadFixture('event.list')!['events']! as List<dynamic>)
            .cast<Map<String, dynamic>>()
            .single;
        final rows = (loadScenarioFixture('populated', 'event.list')!['events']! as List<dynamic>)
            .cast<Map<String, dynamic>>();

        expect(rows.length, 5);
        for (final row in rows) {
          expect(
            _canonical(<String, dynamic>{...row, 'id': parent['id']}),
            _canonical(parent),
            reason: row['id'] as String,
          );
        }
      });

      test('should change only the state and the block reason when blocked-node is read', () {
        final parent = (loadFixture('node.list')!['nodes']! as List<dynamic>)
            .cast<Map<String, dynamic>>()
            .single;
        final row = (loadScenarioFixture('blocked-node', 'node.list')!['nodes']! as List<dynamic>)
            .cast<Map<String, dynamic>>()
            .single;

        expect(row['state'], 'blocked');
        expect(row['blockReason'], 'attempt-limit');
        expect(
          _canonical(<String, dynamic>{
            ...row,
            'state': parent['state'],
            'blockReason': parent['blockReason'],
          }),
          _canonical(parent),
        );
      });

      test('should hold the pinned payload when the empty scenario is read', () {
        expect(
          _canonical(loadScenarioFixture('empty', 'event.list')),
          _canonical(<String, dynamic>{'events': <dynamic>[]}),
        );
      });

      test('should hold the pinned payload when the degraded scenario is read', () {
        expect(
          _canonical(loadScenarioFixture('degraded', 'system.health')),
          _canonical(<String, dynamic>{
            'status': 'degraded',
            'dependencies': <dynamic>[
              <String, dynamic>{'name': 'storage', 'status': 'failed'},
            ],
          }),
        );
      });
    });

    group('the fixture location guard', () {
      test('should hold no fixture tree under the production tree when lib is walked', () {
        final strays = Directory('lib')
            .listSync(recursive: true)
            .map((entry) => entry.path)
            .where(
              (path) =>
                  path.contains('/fixtures/') ||
                  path.contains('/scenarios/') ||
                  path.endsWith('/fixtures') ||
                  path.endsWith('/scenarios'),
            )
            .toList();

        expect(strays, isEmpty);
      });

      test('should hold no published example under the production tree when lib is walked', () {
        final names = Directory('docs/api/contract/examples')
            .listSync()
            .whereType<File>()
            .map((file) => file.uri.pathSegments.last)
            .toSet();
        final strays = Directory('lib')
            .listSync(recursive: true)
            .whereType<File>()
            .where((file) => names.contains(file.uri.pathSegments.last))
            .map((file) => file.path)
            .toList();

        expect(strays, isEmpty);
      });

      test('should point the fixture roots at the test tree when the constants are read', () {
        expect(kFixtureRoot, startsWith('test/'));
        expect(kScenarioRoot, startsWith('test/'));
      });
    });

    group('the composition root guard', () {
      setUp(() async {
        SharedPreferences.setMockInitialValues(<String, Object>{});
        FlutterSecureStorage.setMockInitialValues(<String, String>{});
        await getIt.reset();
        configureDependencies(await SharedPreferences.getInstance());
      });

      tearDown(() async {
        await getIt.reset();
      });

      test('should resolve no simulated type when the production registrations are read', () {
        final resolved = <String>[
          getIt<ThemeModeController>().runtimeType.toString(),
          getIt<BaseUrlStoreType>().runtimeType.toString(),
          getIt<BaseUrlProviderType>().runtimeType.toString(),
          getIt<TokenProviderType>().runtimeType.toString(),
          getIt<ApiConfig>().runtimeType.toString(),
          getIt<KanthordApi>().runtimeType.toString(),
        ];

        for (final name in resolved) {
          expect(_kSimulatedName.hasMatch(name), isFalse, reason: name);
        }
      });

      test('should resolve no mock daemon when the production root is asked', () {
        expect(getIt.isRegistered<MockDaemon>(), isFalse);
      });

      test('should register exactly the inspected types when the root source is read', () {
        final source = File('lib/app/injection.dart').readAsStringSync();

        expect('registerLazySingleton'.allMatches(source).length, 6);
        expect(source.contains('registerFactory'), isFalse);
        expect(source.contains('registerSingletonAsync'), isFalse);
      });
    });
  }
  ```

## Constraints

- **This is a runtime test over the composition root, not a compile-time proof.** It resolves the
  registrations `configureDependencies` makes and inspects the concrete types. It cannot prove that a
  release build excludes the simulated code, and it must not be reported as if it could.
- **`get_it` exposes no way to enumerate its registrations**, so the guard names six types it
  resolves by hand. A seventh registration added later would hold a simulated object and escape the
  type loop entirely. That hole is closed from the other side: the source-text test asserts
  `lib/app/injection.dart` contains exactly six `registerLazySingleton` calls and no other
  registration form, so adding one fails this test and forces the author to extend `resolved`. Say
  both halves when reporting the guard — neither is sufficient alone.
- The source-text test reads `lib/app/injection.dart` as text. It is a coupling to that file's
  shape, and it is deliberate: a count that drifts silently is exactly the failure this guard exists
  to catch. If EPIC 002 changes the registration count, update the literal `6` in the same commit.
  `docs/api/parallel-development.md:245-251` asks for six safeguards; this Story delivers two of
  them, the applied `arch-check` rule delivers a third, and the remaining three need a simulated
  entry point and a running harness that `docs/tdd.md:25-27` says does not exist.
- **The fixture check is literal byte equality, exactly as the EPIC Proof says.** It compares the
  file's whole text against `JsonEncoder.withIndent('  ')` over the example's `success` key plus one
  newline. Three encoders agree on that form and it was verified on all four fixtures before this
  Story was written: Dart's `JsonEncoder.withIndent('  ')`, Node's
  `JSON.stringify(value, null, 2)`, and `prettier --check`. So the fixture is stable under
  `make format-check`, which runs `prettier --check .` over `test/` — `.prettierignore` excludes
  `docs/api/contract/` and does not exclude the fixture tree. Do not relax this to a structural
  comparison, and do not add the fixture tree to `.prettierignore`.
- A hand-edited fixture fails on the value **and** on the whitespace. That is the point: the fixture
  is a machine copy, so any human touch is a defect.
- The guard covers the default fixture set for equality with the example, and the four derived
  overlays for **exactly what they changed**: `populated` may change only `id`, `blocked-node` may
  change only `state` and `blockReason`, and `empty` and `degraded` are pinned literals. An overlay
  edited beyond its declared derivation fails, which is what the EPIC means by a fixture that teaches
  the client a shape the engine never published.
- The simulated-name rule is a substring match on `Mock`, `Fake`, `Stub` and `Simulated`. A new
  simulated implementation registered under any of those names fails without anyone updating a list.
- `getIt.isRegistered<MockDaemon>()` proves the production root carries nothing from
  `test/mock_daemon/`. A test file may import the mock daemon; `lib/` may not, and
  `scripts/arch-check.sh:74-75` is what enforces that half.
- Do not weaken the six resolutions to a `try`/`catch`. A registration that disappears must fail this
  test, because a silently absent registration is exactly what this guard exists to catch.

## Tasks

### Task 011.1 — the release-safety guards

**Input:** `test/app/release_safety_test.dart`

**Action — RED:** write the file exactly as the `## Change` section states.

**Action — GREEN:** run `make test-one T=test/app/release_safety_test.dart`. Every guard is expected
to pass against the tree Stories 01 through 10 built. A failure in the provenance group means a
fixture was edited by hand — restore it from `docs/api/contract/examples/`, and do not relax the
assertion.

## Verify

- `make test-one T=test/app/release_safety_test.dart` exits 0.
- `make arch-check` prints `ARCH: PASS — lib`.
- `make pipeline-test` exits 0, and `scripts/arch-check.test.sh` prints `arch-check.test.sh: PASS`.
  That is the applied `lib` must not import `test` guard staying green.
- `make verify` exits 0.
- The whole EPIC `Proof:` block runs and prints `PASS EPIC-004`.
- Proof: `PASS 004-G7-RELEASE-SAFETY`, `PASS EPIC-004`.
