# Story 07 — the scenarios

Epic: `.agent/plan/epics/004-mock-daemon-and-contract-suite.md`
Depends on: Story 05 (`applyCursor` in the serve path), Story 06.

**Both Tasks are the test-engineer lane.**

## Change

- New `test/mock_daemon/scenarios.dart`:

  ```dart
  import 'dart:convert';
  import 'dart:io';

  const String kScenarioRoot = 'test/mock_daemon/scenarios';
  const String kDefaultScenario = 'default';

  const Set<String> kScenarioBehaviors = <String>{'fixtures', 'slow', 'truncated', 'error'};

  final class Scenario {
    const Scenario({
      required this.name,
      required this.parent,
      required this.behavior,
      this.code,
    });

    final String name;
    final String parent;
    final String behavior;
    final String? code;
  }

  Scenario? loadScenario(String name) {
    if (name == kDefaultScenario) {
      return null;
    }
    final file = File('$kScenarioRoot/$name/scenario.json');
    if (!file.existsSync()) {
      throw ArgumentError.value(name, 'scenario', 'no scenario directory declares it');
    }
    final json = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
    return Scenario(
      name: name,
      parent: json['parent']! as String,
      behavior: json['behavior']! as String,
      code: json['code'] as String?,
    );
  }

  Map<String, dynamic>? loadScenarioFixture(String scenario, String operation) {
    final file = File('$kScenarioRoot/$scenario/$operation.json');
    if (!file.existsSync()) {
      return null;
    }
    return jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
  }

  List<String> scenarioNames() {
    final directories = Directory(kScenarioRoot).listSync().whereType<Directory>();
    return directories.map((entry) => entry.uri.pathSegments[entry.uri.pathSegments.length - 2])
        .toList()
      ..sort();
  }
  ```

- `test/mock_daemon/mock_daemon.dart` — add `import 'scenarios.dart';`, widen `start`, add three
  fields and the truncated writer, and add the scenario stage to `_handle`.

  Replace `start` and the constructor:

  ```dart
    MockDaemon._(this._server, this._scenarioName, this._scenario, this._slowDelay);

    static Future<MockDaemon> start({
      String scenario = kDefaultScenario,
      Duration slowDelay = const Duration(milliseconds: 300),
    }) async {
      final loaded = loadScenario(scenario);
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      final daemon = MockDaemon._(server, scenario, loaded, slowDelay);
      unawaited(daemon._serve());
      return daemon;
    }

    final HttpServer _server;
    final String _scenarioName;
    final Scenario? _scenario;
    final Duration _slowDelay;
  ```

  Insert the scenario stage in `_handle`, immediately after the `_authorized` block and **before**
  the `matchRoute` call:

  ```dart
      final scenario = _scenario;
      if (scenario != null) {
        if (scenario.behavior == 'error') {
          await writeError(
            request.response,
            scenario.code!,
            'the ${scenario.name} scenario is active',
          );
          return;
        }
        if (scenario.behavior == 'truncated') {
          await _writeTruncated(request);
          return;
        }
        if (scenario.behavior == 'slow') {
          await Future<void>.delayed(_slowDelay);
        }
      }
  ```

  Replace the fixture lookup line:

  ```dart
      final fixture = loadFixture(match.route.operation);
  ```

  with:

  ```dart
      final fixture = loadScenarioFixture(_scenarioName, match.route.operation) ??
          loadFixture(match.route.operation);
  ```

  Add the truncated writer after `_authorized`:

  ```dart
    Future<void> _writeTruncated(HttpRequest request) async {
      final socket = await request.response.detachSocket(writeHeaders: false);
      socket.write(
        'HTTP/1.1 200 OK\r\n'
        'content-type: application/json\r\n'
        'content-length: 1024\r\n'
        '\r\n'
        '{"events":[',
      );
      await socket.flush();
      socket.destroy();
    }
  ```

- Six named scenario directories under `test/mock_daemon/scenarios/`. Every directory holds a
  `scenario.json`, and a fixture directory also holds one overlay file named for its operation.

  `empty/scenario.json`:

  ```json
  {
    "parent": "event.list",
    "behavior": "fixtures",
    "reason": "the published example with its rows removed"
  }
  ```

  `empty/event.list.json`:

  ```json
  { "events": [] }
  ```

  `populated/scenario.json`:

  ```json
  {
    "parent": "event.list",
    "behavior": "fixtures",
    "reason": "the published example row repeated under five ascending ids"
  }
  ```

  `populated/event.list.json` — take the single row of
  `docs/api/contract/examples/event.list.json` key `success`, repeat it five times, and set the `id`
  of the copies to these five literals in this order. Change no other field of any copy.

  ```
  event_01JQ8Z7G3H0000000000000001
  event_01JQ8Z7G3H0000000000000002
  event_01JQ8Z7G3H0000000000000003
  event_01JQ8Z7G3H0000000000000004
  event_01JQ8Z7G3H0000000000000005
  ```

  `degraded/scenario.json`:

  ```json
  {
    "parent": "system.health",
    "behavior": "fixtures",
    "reason": "the published example with the roll-up and the dependency degraded"
  }
  ```

  `degraded/system.health.json`:

  ```json
  {
    "status": "degraded",
    "dependencies": [{ "name": "storage", "status": "failed" }]
  }
  ```

  `blocked-node/scenario.json`:

  ```json
  {
    "parent": "node.list",
    "behavior": "fixtures",
    "reason": "the published example with the node blocked on the attempt limit"
  }
  ```

  `blocked-node/node.list.json` — take `docs/api/contract/examples/node.list.json` key `success`,
  set the single row's `state` to `"blocked"` and its `blockReason` to `"attempt-limit"`, and change
  no other field.

  `slow/scenario.json`:

  ```json
  {
    "parent": "system.health",
    "behavior": "slow",
    "reason": "the published example answered after the injected delay"
  }
  ```

  `truncated/scenario.json`:

  ```json
  {
    "parent": "system.health",
    "behavior": "truncated",
    "reason": "a response that declares a length it never writes"
  }
  ```

- Twenty-two error scenario directories, one per code of `kErrorStatus`. Each holds only a
  `scenario.json` and no fixture. The directory name is `error-<code>`. For the code
  `service-unavailable` the directory is `error-service-unavailable` and the file is:

  ```json
  {
    "parent": "system.health",
    "behavior": "error",
    "code": "service-unavailable",
    "reason": "the error key of the published example with the code substituted"
  }
  ```

  Write the same file for each of the other 21 codes, changing only the `code` value: `invalid-request`,
  `unauthenticated`, `origin-forbidden`, `host-forbidden`, `not-found`, `stale-revision`,
  `illegal-transition`, `binding-in-use`, `needs-reconcile`, `acknowledgement-required`,
  `lease-held`, `idempotency-mismatch`, `choices-stale`, `choices-changed`, `host-key-mismatch`,
  `plan-invalid`, `choices-invalid`, `identity-kind-mismatch`, `credential-rejected`,
  `internal-error`, `not-implemented`.

## The pipeline order

This is the whole precedence rule of the daemon, and it is fixed. Every stage below runs in this
order, and Task 007.1 asserts every boundary marked **asserted**.

| #   | Stage                             | Wins over everything below | Asserted in                         |
| --- | --------------------------------- | -------------------------- | ----------------------------------- |
| 1   | drain and record the body         | yes                        | Story 01 `requests`                 |
| 2   | the bearer check                  | **asserted**               | Story 04, and Story 07 vs. scenario |
| 3   | the scenario `error`              | **asserted**               | Story 07                            |
| 4   | the scenario `truncated`          | **asserted**               | Story 07                            |
| 5   | the scenario `slow` delay         | **asserted**               | Story 07                            |
| 6   | `matchRoute`, else `404`          | **asserted**               | Story 03, and Story 07 vs. scenario |
| 7   | `parseCursor`, else `400`         | **asserted**               | Story 05                            |
| 8   | the fixture lookup, else `501`    | **asserted**               | Story 03, and Story 07 vs. scenario |
| 9   | the scenario overlay, then cursor | n/a                        | Story 07                            |

The four cases the order decides, each asserted in Task 007.1:

- a malformed query under an `error` scenario answers the **scenario code**, not `400`;
- a malformed query under `slow` answers `400` **after** the delay;
- a request to an unrouted path under `truncated` is **truncated**, not `404`;
- a request to a fixture-less routed operation under an `error` scenario answers the **scenario
  code**, not `501`.

## Constraints

- A scenario is a **daemon state, not a route state**. `error`, `truncated` and `slow` run after the
  bearer check and before routing, so every path answers the same way. That is what makes an error
  scenario usable to drive a client through one code without knowing which route it will call.
- The bearer rule still precedes every scenario. A scenario never makes the daemon more permissive
  than the contract.
- An overlay file wins over the default fixture for its operation. An operation the scenario does not
  name still serves the default fixture, so `degraded` changes health and leaves the event log alone.
- `slow` delays and then answers normally. It is not an error and not a timeout — the timeout belongs
  to the client that cannot wait.
- `truncated` declares `content-length: 1024` and writes eleven bytes, then destroys the socket. The
  client sees a connection closed mid-body. Use `detachSocket(writeHeaders: false)`, because
  `HttpResponse` refuses to under-write a declared length.
- `loadScenario` throws `ArgumentError` for a name with no directory. A typed scenario name must fail
  loudly rather than silently serve the default set.
- No scenario invents a payload. Each declares its `parent` example and states in `reason` what was
  derived from it. Story 11 asserts that every `parent` names a real file under
  `docs/api/contract/examples/`.
- Twenty-eight directories exactly: six named plus 22 error codes.

## Tasks

### Task 007.1 — the scenario test

**Input:** `test/mock_daemon/scenarios_test.dart`, `test/mock_daemon/scenarios.dart`, the 28
scenario directories

**Action — RED:** create `test/mock_daemon/scenarios_test.dart`. Import `dart:async`, `dart:convert`,
`dart:io`, `package:flutter_test/flutter_test.dart`, `error_envelope.dart`, `http_probe.dart`,
`mock_daemon.dart`, `scenarios.dart`. Drive every request through `probe`, except the truncated
group and the unrouted-truncated case, which use `openProbe`. Every daemon test registers
`addTearDown(daemon.stop)` and marks its body with `// Arrange`, `// Act` and `// Assert`.

Group `loadScenario`:

- `'should return null when the scenario is the default'` — assert
  `loadScenario(kDefaultScenario)` is null.
- `'should return the declaration when the scenario exists'` — assert
  `loadScenario('degraded')!.parent` equals `'system.health'` and `.behavior` equals `'fixtures'`.
- `'should throw when the scenario has no directory'` — assert
  `() => loadScenario('no-such-scenario')` throws an `ArgumentError`.

Group `scenarioNames`:

- `'should hold twenty-eight directories when the scenario tree is listed'` — assert the length is
  `28`.
- `'should declare a known behavior when every scenario is read'` — for every name, assert
  `kScenarioBehaviors.contains(loadScenario(name)!.behavior)`.
- `'should declare a code from the published table when the behavior is error'` — for every scenario
  whose behavior is `'error'`, assert `kErrorStatus.containsKey(scenario.code)` and assert the
  directory name equals `'error-${scenario.code}'`.
- `'should hold one directory per published error code when the error scenarios are counted'` —
  assert the set of error-scenario codes equals `kErrorStatus.keys.toSet()`.
- `'should name the six behavioral scenarios when the tree is listed'` — assert the names contain
  `empty`, `populated`, `degraded`, `blocked-node`, `slow` and `truncated`.

Group `MockDaemon`, nested group `the empty scenario`:

- `'should answer an empty page when the event log is read'` — start with `scenario: 'empty'`, `GET`
  `'/v1/event'`, assert the status is `200` and `events` is an empty list.
- `'should answer the default fixture when an operation the scenario does not name is read'` — the
  same daemon, `GET` `'/v1/health'`, assert the status is `200` and the body equals the published
  `system.health` success object.

Nested group `the populated scenario` — this is the end-to-end paging proof:

- `'should answer five rows when no cursor is sent'` — assert the `events` ids are the five pinned
  literals in ascending order.
- `'should answer the first rows when a limit is sent'` — `?limit=2`, assert ids `…0001` and
  `…0002`.
- `'should answer the rows above the cursor when an after is sent'` —
  `?after=event_01JQ8Z7G3H0000000000000002`, assert ids `…0003`, `…0004`, `…0005`.
- `'should apply the limit after the cursor when both are sent'` —
  `?after=event_01JQ8Z7G3H0000000000000002&limit=2`, assert ids `…0003` and `…0004`.
- `'should answer an empty page when the after sorts above every row'` —
  `?after=event_01JQ8Z7G3H0000000000000005`, assert the array is empty and the status is `200`.

Nested group `the degraded scenario`:

- `'should answer the degraded roll-up when health is read'` — assert `status` is `'degraded'`.
- `'should answer a failed dependency when health is read'` — assert the single dependency has
  `name` `'storage'` and `status` `'failed'`.

Nested group `the blocked-node scenario`:

- `'should answer a blocked node when the node list is read'` — `GET` `'/v1/node'`, assert the single
  row's `state` is `'blocked'` and its `blockReason` is `'attempt-limit'`.

Nested group `the slow scenario`:

- `'should answer after the injected delay when a request arrives'` — start with
  `scenario: 'slow', slowDelay: Duration(milliseconds: 300)`, time a `GET` `'/v1/health'` with a
  `Stopwatch`, assert the elapsed time is at least `300` milliseconds and the status is `200`.
- `'should exceed a shorter client deadline when a request arrives'` — the same daemon; wrap the
  `GET` future in `.timeout(const Duration(milliseconds: 50))` and assert it throws a
  `TimeoutException`.

Nested group `the truncated scenario` — a bare `throwsA(isA<Exception>())` proves nothing here,
because a refused connection, a malformed header and a dead accept loop all satisfy it. Assert the
response first, then the failed drain. Use `openProbe`, which returns the response without draining
it:

- `'should answer two hundred when the connection closes mid-body'` — start with
  `scenario: 'truncated'`, `openProbe('${daemon.baseUrl}/v1/health')`, assert `statusCode` is `200`.
- `'should declare a content length it does not write when the connection closes mid-body'` — the
  same response, assert `contentLength` equals `1024`.
- `'should throw while draining when the connection closes mid-body'` — the same response; assert
  `utf8.decoder.bind(response).join()` throws an `HttpException`. That pair — a good response and a
  failed drain — is what proves truncation rather than any other failure.
- `'should answer the next request when a response was truncated'` — the same daemon, after the
  failed drain, start a second `probe` against `'/v1/health'` and assert it also reaches the
  `truncated` behavior with `statusCode` `200`. This proves the error boundary of Story 01 kept the
  accept loop alive.

Nested group `the error scenarios`:

- `'should answer the mapped status when an error scenario is active'` — loop over
  `kErrorStatus.entries`; for each, start a daemon with `scenario: 'error-${entry.key}'`, register
  the tear-down, `GET` `'/v1/health'`, and assert the status equals `entry.value` and the body's
  error `code` equals `entry.key`. One `test` with the loop inside is correct here; add
  `reason: entry.key` to each `expect` so a failure names the code.
- `'should answer the same error when the path is unregistered'` — start with
  `scenario: 'error-service-unavailable'`, `GET` `'/v1/nope'`, assert the status is `503` and not
  `404`. This proves a scenario is a daemon state.
- `'should answer unauthenticated when the token is absent and an error scenario is active'` — the
  same daemon with `token: null`, assert the status is `401` and not `503`. This proves the bearer
  rule still precedes the scenario.

Nested group `the pipeline order` — one test per row of the precedence table above:

- `'should answer the scenario code when the query is malformed and an error scenario is active'` —
  start with `scenario: 'error-service-unavailable'`, `GET` `'/v1/event?limit=0'`, assert the status
  is `503` and not `400`.
- `'should answer the scenario code when the operation has no fixture and an error scenario is active'`
  — the same daemon, `GET` `'/v1/project'`, assert the status is `503` and not `501`.
- `'should truncate the response when the path is unrouted and the truncated scenario is active'` —
  start with `scenario: 'truncated'`, `openProbe('/v1/nope')`, assert `statusCode` is `200` and not
  `404`, and assert the drain throws.
- `'should answer invalid-request after the delay when the query is malformed and the slow scenario is active'`
  — start with `scenario: 'slow', slowDelay: Duration(milliseconds: 300)`, time `GET`
  `'/v1/event?limit=0'`, assert the status is `400` and the elapsed time is at least `300`
  milliseconds.

**Action — GREEN:** the same role writes `scenarios.dart`, the 28 directories and the
`mock_daemon.dart` edits, then re-runs the file.

## Verify

- `make test-one T=test/mock_daemon/scenarios_test.dart` exits 0.
- `make test-one T=test/mock_daemon/mock_daemon_test.dart`,
  `make test-one T=test/mock_daemon/contract_enforcement_test.dart` and
  `make test-one T=test/mock_daemon/cursor_test.dart` all still exit 0. `start()` gained two
  defaulted named parameters, so no existing call site changes.
- `make verify` exits 0.
- Proof: `PASS 004-G4-SCENARIOS`.
