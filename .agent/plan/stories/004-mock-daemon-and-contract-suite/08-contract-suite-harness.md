# Story 08 — the contract suite harness

Epic: `.agent/plan/epics/004-mock-daemon-and-contract-suite.md`
Depends on: Story 07 (the error scenarios), EPIC 001 Story 10 (`KanthordApi`, `lib/api/api.dart`).

**Both Tasks are the test-engineer lane.**

## Change

- New `test/api/contract/contract_case.dart`:

  ```dart
  import 'dart:convert';
  import 'dart:io';

  import 'package:flutter_test/flutter_test.dart';
  import 'package:kanthord/api/api.dart';

  import '../../mock_daemon/mock_daemon.dart';

  final class ContractBaseUrlProvider implements BaseUrlProviderType {
    ContractBaseUrlProvider(this.value);

    String value;

    @override
    Future<String> baseUrl() async => value;
  }

  final class ContractTokenProvider implements TokenProviderType {
    ContractTokenProvider(this.value);

    String? value;

    @override
    Future<String?> token() async => value;

    @override
    Future<void> save(String token) async {
      value = token;
    }

    @override
    Future<void> clear() async {
      value = null;
    }
  }

  KanthordApi contractApi(String baseUrl, {String? token = kMockDaemonToken}) => KanthordApi(
    config: ApiConfig(baseUrlProvider: ContractBaseUrlProvider(baseUrl)),
    tokens: ContractTokenProvider(token),
  );

  Map<String, dynamic> publishedExample(String operation) =>
      jsonDecode(File('docs/api/contract/examples/$operation.json').readAsStringSync())
          as Map<String, dynamic>;

  Map<String, dynamic> publishedSuccess(String operation) =>
      publishedExample(operation)['success']! as Map<String, dynamic>;

  String publishedErrorCode(String operation) {
    final envelope = publishedExample(operation)['error']! as Map<String, dynamic>;
    final error = envelope['error']! as Map<String, dynamic>;
    return error['code']! as String;
  }

  final class ContractCase {
    const ContractCase({
      required this.operation,
      required this.method,
      required this.path,
      required this.invoke,
      required this.decoded,
      this.requestBody = '',
      this.readOnly = true,
    });

    final String operation;
    final String method;
    final String path;
    final Future<Object?> Function(KanthordApi api) invoke;
    final Matcher decoded;
    final String requestBody;
    final bool readOnly;
  }

  void runContractCase(ContractCase testCase) {
    group(testCase.operation, () {
      test('should decode the published example when ${testCase.operation} is called', () async {
        final daemon = await MockDaemon.start();
        addTearDown(daemon.stop);

        final result = await testCase.invoke(contractApi(daemon.baseUrl));

        expect(result, testCase.decoded);
      });

      test('should serialize the request when ${testCase.operation} is called', () async {
        final daemon = await MockDaemon.start();
        addTearDown(daemon.stop);

        await testCase.invoke(contractApi(daemon.baseUrl));

        final recorded = daemon.requests.single;
        expect(recorded.method, testCase.method);
        expect(recorded.path, testCase.path);
        expect(recorded.query, isEmpty);
        expect(recorded.body, testCase.requestBody);
        expect(recorded.headers['authorization'], 'Bearer $kMockDaemonToken');
        expect(
          recorded.headers[ApiConfig.clientHeader.toLowerCase()],
          ApiConfig.clientVersion,
        );
      });

      test('should map the published error envelope when ${testCase.operation} fails', () async {
        final code = publishedErrorCode(testCase.operation);
        final daemon = await MockDaemon.start(scenario: 'error-$code');
        addTearDown(daemon.stop);

        await expectLater(
          testCase.invoke(contractApi(daemon.baseUrl)),
          throwsA(isA<ApiResponseException>().having((error) => error.code, 'code', code)),
        );
      });
    });
  }
  ```

- `test/api/contract/contract_case.dart` — declare the operation table in the **helper**, not in the
  suite file, because Story 10 iterates the same table:

  ```dart
  final List<ContractCase> kContractCases = <ContractCase>[
    ContractCase(
      operation: 'system.db',
      method: 'GET',
      path: '/v1/db/status',
      invoke: (api) => api.system.db(),
      decoded: isA<DbStatus>(),
    ),
    ContractCase(
      operation: 'system.health',
      method: 'GET',
      path: '/v1/health',
      invoke: (api) => api.system.health(),
      decoded: isA<Health>(),
    ),
  ];
  ```

- New `test/api/contract/contract_suite_test.dart`:

  ```dart
  import 'package:flutter_test/flutter_test.dart';

  import 'contract_case.dart';

  void main() {
    group('the contract suite', () {
      test('should name every covered operation when the suite is enumerated', () {
        expect(
          kContractCases.map((testCase) => testCase.operation).toList(),
          <String>['system.db', 'system.health'],
        );
      });

      test('should cover two operations when the suite is counted', () {
        expect(kContractCases.length, 2);
      });
    });

    for (final testCase in kContractCases) {
      runContractCase(testCase);
    }
  }
  ```

## Constraints

- The suite runs against the **mock daemon over real HTTP**, through a real `Dio` and both
  interceptors. It never builds a fake `KanthordApi` and never installs a mock adapter.
  `docs/api/parallel-development.md:80-84` states why: the defects live in the Dio path.
- **Every Dart snippet in this EPIC omits the `// Arrange`, `// Act` and `// Assert` markers for
  brevity. Add them.** `docs/testing.md:18-19` requires all three in every test body, at the setup,
  the call and the expectation, and allows no other comment. A snippet shows the code, not the final
  comment placement.
- Four assertions per row, each its own `test`, each naming the operation and its **category**. The
  four categories of `docs/api/parallel-development.md:218-225` map to the four tests as: decode
  conformance, request serialization, **semantics**, and wire field names. For these two rows the
  semantics assertion is the error-envelope mapping, because a `GET` with no parameters has no other
  semantic surface. EPIC 006 adds rows whose semantics assertion is a cursor page or a `501`, and
  it may widen this test into a supplied callback then. Do not widen it now.
- `requestBody` defaults to the empty string, and the request-serialization test asserts it. Both
  rows are `GET`, so both assert an empty body — a resource method that quietly sent one would fail.
- `readOnly` marks a row the live lane may run. Both rows are `readOnly: true`. A future mutating row
  sets it false and the live lane skips it by construction, never by a `skip:`.
- Two rows, and the count is asserted. A row removed from `kContractCases` fails
  `'should cover two operations when the suite is counted'`, so the suite cannot shrink silently.
- The expected error code is read from the published example, never typed as a literal. Both rows
  publish `service-unavailable`, and the scenario name follows from the code.
- `kContractCases` lives in `contract_case.dart`, so `contract_suite_test.dart` and
  `live_lane_test.dart` share one table. Never declare a second table, and never import one
  `_test.dart` file from another.
- The suite is never skipped and carries no `skip:` argument. `HANDOFF.md:191-192` requires it to run
  on every `make test` from day one.
- Two rows only. `docs/api/operations.md` declares 54 operations, and EPIC 001 delivered a method for
  two. EPIC 006 adds a row per operation as it adds the model.
- `ContractTokenProvider` and `ContractBaseUrlProvider` are test doubles that live under `test/`.
  They implement the SDK interfaces of EPIC 001 Story 02 and Story 05 and add nothing to `lib/`.
- The client header is read back lower-cased. `dart:io` lower-cases every received header name, so
  compare against `ApiConfig.clientHeader.toLowerCase()`.

## Tasks

### Task 008.1 — the harness and the two rows

**Input:** `test/api/contract/contract_case.dart`, `test/api/contract/contract_suite_test.dart`

**Action — RED:** write both files exactly as the `## Change` section states. `contract_case.dart`
declares no `main` and is a helper, so `flutter test` collects only `contract_suite_test.dart` from
it.

The suite fails first because the two helper files do not exist. There is no separate production
seam in this Story — every file is in the test lane, so the same role writes both.

**Action — GREEN:** run `make test-one T=test/api/contract` and make the three assertions per row
pass. Change nothing under `lib/`. If the request-serialization test fails on a header name, fix the
case of the lookup in the harness, not the SDK.

## Verify

- `make test-one T=test/api/contract` exits 0 and runs six operation tests plus the two suite tests.
- `make verify` exits 0.
- Proof: none of its own. It is one half of `PASS 004-G5-SUITE`, which Story 09 delivers.
