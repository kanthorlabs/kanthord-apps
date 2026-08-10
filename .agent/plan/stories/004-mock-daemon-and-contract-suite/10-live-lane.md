# Story 10 — the live lane

Epic: `.agent/plan/epics/004-mock-daemon-and-contract-suite.md`
Depends on: Story 08 (`contractApi`, `kContractCases`), Story 09 (`requiredFields`, `toWire`).

**One Task, the test-engineer lane.**

## Change

- New `test/api/contract/live_lane_test.dart`:

  ```dart
  import 'dart:io';

  import 'package:flutter_test/flutter_test.dart';
  import 'package:kanthord/api/api.dart';

  import 'contract_case.dart';

  const String kLiveBaseUrlVariable = 'KANTHORD_LIVE_BASE_URL';
  const String kLiveTokenVariable = 'KANTHORD_LIVE_TOKEN';
  const String kConfigured = 'configured';
  const String kNotConfigured = 'not configured';

  String liveLaneStatus(String? baseUrl, String? token) =>
      (baseUrl != null && baseUrl.isNotEmpty && token != null && token.isNotEmpty)
      ? kConfigured
      : kNotConfigured;

  void main() {
    final baseUrl = Platform.environment[kLiveBaseUrlVariable];
    final token = Platform.environment[kLiveTokenVariable];
    final status = liveLaneStatus(baseUrl, token);

    group('liveLaneStatus', () {
      test('should report not configured when neither variable is set', () {
        expect(liveLaneStatus(null, null), kNotConfigured);
      });

      test('should report not configured when the base URL is absent', () {
        expect(liveLaneStatus(null, 'a-token'), kNotConfigured);
      });

      test('should report not configured when the token is absent', () {
        expect(liveLaneStatus('http://127.0.0.1:31415', null), kNotConfigured);
      });

      test('should report not configured when the base URL is empty', () {
        expect(liveLaneStatus('', 'a-token'), kNotConfigured);
      });

      test('should report not configured when the token is empty', () {
        expect(liveLaneStatus('http://127.0.0.1:31415', ''), kNotConfigured);
      });

      test('should report configured when both variables are set', () {
        expect(liveLaneStatus('http://127.0.0.1:31415', 'a-token'), kConfigured);
      });
    });

    group('the live lane [$status]', () {
      test('should read the environment when the lane is built [$status]', () {
        expect(status, anyOf(kConfigured, kNotConfigured));
      });

      test('should cover every read operation of the shared suite when the lane is built', () {
        expect(
          kContractCases.where((testCase) => testCase.readOnly).length,
          kContractCases.length,
        );
      });

      for (final testCase in kContractCases.where((testCase) => testCase.readOnly)) {
        test(
          'should decode the live response when ${testCase.operation} is called [$status]',
          () async {
            if (status == kNotConfigured) {
              expect(status, kNotConfigured);
              return;
            }
            final api = contractApi(baseUrl!, token: token);

            final result = await testCase.invoke(api);

            expect(result, testCase.decoded);
          },
        );

        test(
          'should carry the required wire field names when ${testCase.operation} is called [$status]',
          () async {
            if (status == kNotConfigured) {
              expect(status, kNotConfigured);
              return;
            }
            final api = contractApi(baseUrl!, token: token);

            final wire = testCase.toWire(await testCase.invoke(api));

            for (final field in testCase.requiredFields) {
              expect(wire.containsKey(field), isTrue, reason: field);
            }
          },
        );
      }
    });
  }
  ```

## Constraints

- **It is the same suite, pointed at a different target.** The lane iterates `kContractCases` from
  `contract_case.dart`, the one table `contract_suite_test.dart` also runs, and it applies the two
  assertions a live target can support. It never declares its own operation list, so a row added in
  EPIC 006 reaches the live lane without anyone remembering to add it.
- It applies **two** of the four assertions, and that is not a shortfall to hide. Request
  serialization needs recorded requests, which a real daemon does not expose. The error-envelope
  assertion needs the daemon to fail on command, which needs a scenario the daemon does not have.
  Both are proved against the mock and cannot be proved live.
- **The status is reported in the test name, not by a matcher.** `[$status]` is interpolated into the
  group name and every live test name, so the runner prints `not configured` or `configured` on
  every run. An `expect` that passes prints nothing, so a matcher alone would report nothing at all.
- **No `skip:`, no `markTestSkipped`, no `@Skip`.** A skipped gate is not a gate. With no
  environment variables every test in this file runs and passes.
- Read operations only, enforced by `testCase.readOnly` rather than by a hand-kept list. Both current
  rows are `GET`. `project.create`, `repository.register` and `plan.import` mutate a daemon and the
  engine offers no setup and no cleanup, so a future row marks itself `readOnly: false` and this
  lane never reaches it.
- Assert shape and required field names only. Never a minted id, never a timestamp, never
  `appliedAt`, never a dependency count, never a value.
  `docs/api/parallel-development.md:228` says a live response never equals a fixture byte for byte.
- The two variables must both be set and both be non-empty. A base URL with an empty token would
  reach a real daemon and answer `401`, which is a false failure rather than a lane.
- `Platform.environment` is read at run time. Do not use `String.fromEnvironment`, which is a
  compile-time constant and would need a `--dart-define` at every invocation.
- The file lives under `test/api/contract/`, so `make test-one T=test/api/contract` already runs it.
  The EPIC Proof also names it alone, and both invocations must pass.

## Tasks

### Task 010.1 — the live lane

**Input:** `test/api/contract/live_lane_test.dart`

**Action — RED:** write the file exactly as the `## Change` section states.

**Action — GREEN:** run `make test-one T=test/api/contract/live_lane_test.dart` with neither variable
set. Every test must pass and none may report a skip. Confirm the runner reports twelve passing
tests — six for `liveLaneStatus`, two for the lane itself, and two per read-only row — zero skipped,
and `[not configured]` in the printed names.

## Verify

- `make test-one T=test/api/contract/live_lane_test.dart` exits 0 with no environment variable set,
  and reports no skipped test.
- `make test-one T=test/api/contract` exits 0.
- `make verify` exits 0.
- `NEEDS-HUMAN:` the configured branch. `make verify` sets neither variable, so the two live tests
  only run their not-configured path in the gate. To prove the other branch, start a daemon with the
  four variables of `AGENTS.md`, then run:

  ```bash
  KANTHORD_LIVE_BASE_URL=http://localhost:31415 \
    KANTHORD_LIVE_TOKEN=<the daemon token> \
    make test-one T=test/api/contract/live_lane_test.dart
  ```

  Report the result in the ready marker. Do not claim the live lane is proved from a headless run.

- Proof: `PASS 004-G6-LIVE-LANE`.
