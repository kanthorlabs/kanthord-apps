# Story 09 — the wire-name rule

Epic: `.agent/plan/epics/004-mock-daemon-and-contract-suite.md`
Depends on: Story 08 (the harness and the two rows).

**Both Tasks are the test-engineer lane.** This Story adds the fourth assertion and delivers
`PASS 004-G5-SUITE`.

A wire rename that keeps the Dart property name compiles, decodes and ships a broken client.
`docs/api/conventions.md:21-25` names this suite as the only thing that catches it.

## Change

- `test/api/contract/contract_case.dart` — add three fields to `ContractCase`:

  ```dart
      required this.requiredFields,
      required this.requiredItemFields,
      required this.toWire,
  ```

  ```dart
    final Set<String> requiredFields;
    final Map<String, Set<String>> requiredItemFields;
    final Map<String, dynamic> Function(Object? result) toWire;
  ```

- `test/api/contract/contract_case.dart` — add the fourth `test` inside `runContractCase`, after the
  error-envelope test:

  ```dart
      test(
        'should carry the published wire field names when ${testCase.operation} is called',
        () async {
          final example = publishedSuccess(testCase.operation);
          final daemon = await MockDaemon.start();
          addTearDown(daemon.stop);

          final result = await testCase.invoke(contractApi(daemon.baseUrl));
          final wire = testCase.toWire(result);

          for (final field in testCase.requiredFields) {
            expect(example.containsKey(field), isTrue, reason: 'the example omits $field');
            expect(wire.containsKey(field), isTrue, reason: 'the model omits $field');
          }
          testCase.requiredItemFields.forEach((array, fields) {
            final published = (example[array]! as List<dynamic>).cast<Map<String, dynamic>>();
            final encoded = (wire[array]! as List<dynamic>).cast<Map<String, dynamic>>();
            for (final field in fields) {
              for (final item in published) {
                expect(item.containsKey(field), isTrue, reason: 'the example omits $array.$field');
              }
              for (final item in encoded) {
                expect(item.containsKey(field), isTrue, reason: 'the model omits $array.$field');
              }
            }
          });
        },
      );
  ```

- `test/api/contract/contract_case.dart` — fill the three new fields on both rows of
  `kContractCases`. The values are transcribed from `docs/api/contract/features/system.yaml`, from
  the `required` list of each response schema.

  `system.db`, from `system.db.response` at `docs/api/contract/features/system.yaml:300-331`:

  ```dart
      requiredFields: const <String>{'migrations'},
      requiredItemFields: const <String, Set<String>>{
        'migrations': <String>{'version', 'name', 'applied', 'appliedAt'},
      },
      toWire: (result) => (result! as DbStatus).toJson(),
  ```

  `system.health`, from `system.health.response` at
  `docs/api/contract/features/system.yaml:451-478`:

  ```dart
      requiredFields: const <String>{'status', 'dependencies'},
      requiredItemFields: const <String, Set<String>>{
        'dependencies': <String>{'name', 'status'},
      },
      toWire: (result) => (result! as Health).toJson(),
  ```

- `test/api/contract/contract_suite_test.dart` — add one test to the `the contract suite` group:

  ```dart
      test('should declare a required field for every covered operation when the suite is read', () {
        for (final testCase in kContractCases) {
          expect(testCase.requiredFields, isNotEmpty, reason: testCase.operation);
        }
      });
  ```

## Constraints

- Only a **required** field is asserted against the example. An optional field is absent from both
  sets, because `docs/api/conventions.md:21-25` and the EPIC both say an example may legitimately
  omit one, and asserting it against one example would make a legal payload fail.
- The required sets are transcribed from `docs/api/contract/features/system.yaml`, not parsed. No
  YAML parser exists in the tree: `yaml` is absent from `pubspec.yaml`, and
  `scripts/lane-check.sh:41` denies `pubspec.yaml` to every role. The line numbers above are the
  provenance, and the test above proves neither set is empty.
- The assertion is on the **name**, on both sides. A field must appear in the published example and
  in `toJson()` of the model. That pair is what catches a `@JsonKey(name:)` rename, which decoding
  alone never notices.
- The assertion is a field-name check and nothing more. It enforces no pattern, no bound and no
  `additionalProperties`. The EPIC non-goal is explicit: say what it proves and no more.
- `build.yaml:20` sets `include_if_null: false`, so a required-and-nullable field encodes only when
  it holds a value. Both published examples carry a value for every required field, including
  `appliedAt`, so the rule holds here. A future row whose example carries an explicit null needs
  `@JsonKey(includeIfNull: true)` on the model, and that is EPIC 006 work.
- Add no fifth assertion. Four per row, named separately.

## Tasks

### Task 009.1 — the wire-name assertion

**Input:** `test/api/contract/contract_case.dart`, `test/api/contract/contract_suite_test.dart`

The `ContractCase` declaration, the `runContractCase` body and `kContractCases` all live in
`contract_case.dart`. Only the suite-level test is added to `contract_suite_test.dart`.

**Action — RED:** apply every edit of the `## Change` section. The suite gains one test per row and
one suite-level test, so `make test-one T=test/api/contract` runs eight operation tests plus three
suite tests.

**Action — GREEN:** run `make test-one T=test/api/contract`. The models of EPIC 001 already annotate
every field with `@JsonKey(name:)` against the same examples, so the assertion is expected to pass on
the first run. If it fails, the defect is a wrong `@JsonKey(name:)` under `lib/api/models/` — report
it as a blocker and do not edit `lib/`, which is not this role's lane.

## Verify

- `make test-one T=test/api/contract` exits 0.
- `make verify` exits 0.
- Proof: `PASS 004-G5-SUITE`.
