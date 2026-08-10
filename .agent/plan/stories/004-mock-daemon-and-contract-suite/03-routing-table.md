# Story 03 — the routing table and the fixture store

Epic: `.agent/plan/epics/004-mock-daemon-and-contract-suite.md`
Depends on: Story 02 (`writeError`, `writeJson`).

**Both Tasks are the test-engineer lane.**

## Change

- New `test/mock_daemon/routes.dart`:

  ```dart
  final class MockRoute {
    const MockRoute(
      this.operation,
      this.method,
      this.template,
      this.declared, {
      this.queryKeys = const <String>{},
    });

    final String operation;
    final String method;
    final String template;
    final String declared;
    final Set<String> queryKeys;
  }

  final class RouteMatch {
    const RouteMatch(this.route, this.parameters);

    final MockRoute route;
    final Map<String, String> parameters;
  }

  const Set<String> kEventQueryKeys = <String>{
    'actor',
    'actorKind',
    'after',
    'limit',
    'subject',
    'subjectKind',
    'type',
  };

  const List<MockRoute> kRoutes = <MockRoute>[
    MockRoute('system.db', 'GET', '/v1/db/status', 'routed'),
    MockRoute('system.health', 'GET', '/v1/health', 'routed'),
    MockRoute('system.status', 'GET', '/v1/status', 'routed'),
    MockRoute('blob.show', 'GET', '/v1/blob/:hash', 'routed'),
    MockRoute('provider.list', 'GET', '/v1/provider', 'routed'),
    MockRoute('provider.register', 'POST', '/v1/provider', 'routed'),
    MockRoute('provider.show', 'GET', '/v1/provider/:id', 'routed'),
    MockRoute('provider.remove', 'DELETE', '/v1/provider/:id', 'stubbed'),
    MockRoute('provider.rename', 'POST', '/v1/provider/:id/rename', 'stubbed'),
    MockRoute('provider.setDefault', 'PUT', '/v1/provider/:id/default', 'stubbed'),
    MockRoute('repository.register', 'POST', '/v1/repository', 'routed'),
    MockRoute('repository.list', 'GET', '/v1/repository', 'routed'),
    MockRoute('repository.show', 'GET', '/v1/repository/:id', 'routed'),
    MockRoute('repository.inspect', 'POST', '/v1/repository/inspect', 'routed'),
    MockRoute('repository.reconcile', 'POST', '/v1/repository/:id/reconcile', 'stubbed'),
    MockRoute('repository.publish', 'POST', '/v1/repository/:id/publish', 'stubbed'),
    MockRoute('repository.landingBranch', 'POST', '/v1/repository/:id/landing-branch', 'stubbed'),
    MockRoute('profile.export', 'GET', '/v1/repository/:id/profile', 'stubbed'),
    MockRoute('profile.import', 'PUT', '/v1/repository/:id/profile', 'stubbed'),
    MockRoute('profile.instantiate', 'POST', '/v1/repository/:id/profile', 'stubbed'),
    MockRoute('profile.verify', 'POST', '/v1/repository/:id/profile/verify', 'stubbed'),
    MockRoute('project.create', 'POST', '/v1/project', 'routed'),
    MockRoute('project.list', 'GET', '/v1/project', 'routed'),
    MockRoute('project.show', 'GET', '/v1/project/:id', 'routed'),
    MockRoute('project.status', 'GET', '/v1/project/:id/status', 'routed'),
    MockRoute('project.repositories', 'PUT', '/v1/project/:id/repository', 'routed'),
    MockRoute('binding.worker.project', 'PUT', '/v1/project/:id/binding/worker', 'stubbed'),
    MockRoute('plan.validate', 'POST', '/v1/project/:id/plan/validate', 'routed'),
    MockRoute('plan.import', 'POST', '/v1/project/:id/plan/import', 'routed'),
    MockRoute('plan.export', 'GET', '/v1/project/:id/plan/export', 'routed'),
    MockRoute('plan.revisions', 'GET', '/v1/project/:id/plan/revision', 'routed'),
    MockRoute('node.list', 'GET', '/v1/node', 'routed'),
    MockRoute('node.show', 'GET', '/v1/node/:id', 'routed'),
    MockRoute('edge.list', 'GET', '/v1/project/:id/edge', 'routed'),
    MockRoute('node.unblock', 'POST', '/v1/node/:id/unblock', 'stubbed'),
    MockRoute('node.abandon', 'POST', '/v1/node/:id/abandon', 'stubbed'),
    MockRoute('node.approve', 'POST', '/v1/node/:id/approve', 'stubbed'),
    MockRoute('node.approvalEvidence', 'GET', '/v1/node/:id/approval', 'stubbed'),
    MockRoute('node.discard', 'POST', '/v1/node/:id/discard', 'stubbed'),
    MockRoute('node.waive', 'POST', '/v1/node/:id/waive', 'stubbed'),
    MockRoute('run.start', 'POST', '/v1/project/:id/run', 'stubbed'),
    MockRoute('run.cancel', 'POST', '/v1/run/:id/cancel', 'stubbed'),
    MockRoute('run.list', 'GET', '/v1/run', 'stubbed'),
    MockRoute('run.show', 'GET', '/v1/run/:id', 'stubbed'),
    MockRoute('node.attempts', 'GET', '/v1/node/:id/attempt', 'stubbed'),
    MockRoute('attempt.show', 'GET', '/v1/attempt/:id', 'stubbed'),
    MockRoute('node.checks', 'GET', '/v1/node/:id/check', 'stubbed'),
    MockRoute('worker.list', 'GET', '/v1/worker', 'stubbed'),
    MockRoute('agent.list', 'GET', '/v1/agent', 'stubbed'),
    MockRoute('instructions.resolve', 'GET', '/v1/instruction/resolve', 'stubbed'),
    MockRoute('template.list', 'GET', '/v1/template', 'stubbed'),
    MockRoute('template.show', 'GET', '/v1/template/:id', 'stubbed'),
    MockRoute('event.list', 'GET', '/v1/event', 'routed', queryKeys: kEventQueryKeys),
    MockRoute('gitOperation.list', 'GET', '/v1/git-operation', 'stubbed'),
  ];

  final RegExp _kResourceId = RegExp(r'^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$');
  final RegExp _kBlobHash = RegExp(r'^[a-z0-9]+:[0-9a-f]+$');

  RouteMatch? matchRoute(String method, String path) {
    final segments = path.split('/');
    for (final route in kRoutes) {
      if (route.method != method) {
        continue;
      }
      final template = route.template.split('/');
      if (template.length != segments.length) {
        continue;
      }
      final parameters = <String, String>{};
      var matched = true;
      for (var index = 0; index < template.length; index += 1) {
        final expected = template[index];
        final actual = segments[index];
        if (!expected.startsWith(':')) {
          if (expected != actual) {
            matched = false;
            break;
          }
          continue;
        }
        final name = expected.substring(1);
        final pattern = name == 'hash' ? _kBlobHash : _kResourceId;
        if (!pattern.hasMatch(actual)) {
          matched = false;
          break;
        }
        parameters[name] = actual;
      }
      if (matched) {
        return RouteMatch(route, parameters);
      }
    }
    return null;
  }
  ```

- New `test/mock_daemon/fixtures.dart`:

  ```dart
  import 'dart:convert';
  import 'dart:io';

  const String kFixtureRoot = 'test/mock_daemon/fixtures';

  const List<String> kDefaultFixtureOperations = <String>[
    'event.list',
    'node.list',
    'system.db',
    'system.health',
  ];

  Map<String, dynamic>? loadFixture(String operation) {
    final file = File('$kFixtureRoot/$operation.json');
    if (!file.existsSync()) {
      return null;
    }
    return jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
  }
  ```

- Four new fixture files, each holding the `success` object of the matching published example and
  nothing else. **Extraction is not a copy of bytes — the subtree must be re-serialized — so the
  serialization is pinned here.** Produce each file with exactly this command, which writes
  two-space indentation, preserves key order, and ends with one newline:

  ```bash
  for op in system.health system.db event.list node.list; do
    node -e "
      const fs = require('fs');
      const example = JSON.parse(fs.readFileSync('docs/api/contract/examples/$op.json', 'utf8'));
      fs.writeFileSync('test/mock_daemon/fixtures/$op.json',
        JSON.stringify(example.success, null, 2) + '\n');
    "
  done
  ```

  This form is verified, not assumed. `JSON.stringify(value, null, 2)` plus one newline is
  byte-identical to `prettier --check` and to Dart's `JsonEncoder.withIndent('  ')` plus one newline
  for all four fixtures, so the file is stable under `make format-check` and Story 11 asserts the
  bytes exactly. `node` is already required by `make format` (`Makefile:93-97`).

  `test/mock_daemon/fixtures/system.health.json` must come out exactly as:

  ```json
  {
    "status": "ok",
    "dependencies": [
      {
        "name": "storage",
        "status": "ok"
      }
    ]
  }
  ```

  | New file                                       | Source                                                        |
  | ---------------------------------------------- | ------------------------------------------------------------- |
  | `test/mock_daemon/fixtures/system.health.json` | `docs/api/contract/examples/system.health.json` key `success` |
  | `test/mock_daemon/fixtures/system.db.json`     | `docs/api/contract/examples/system.db.json` key `success`     |
  | `test/mock_daemon/fixtures/event.list.json`    | `docs/api/contract/examples/event.list.json` key `success`    |
  | `test/mock_daemon/fixtures/node.list.json`     | `docs/api/contract/examples/node.list.json` key `success`     |

- `test/mock_daemon/mock_daemon.dart` — add `import 'fixtures.dart';` and `import 'routes.dart';`
  after the existing `error_envelope.dart` import, and replace the whole body of `_handle`:

  ```dart
    Future<void> _handle(HttpRequest request) async {
      final match = matchRoute(request.method, request.uri.path);
      if (match == null) {
        await writeError(request.response, 'not-found', 'no route matches the request');
        return;
      }
      final fixture = loadFixture(match.route.operation);
      if (fixture == null) {
        await writeError(
          request.response,
          'not-implemented',
          'the operation ${match.route.operation} ships in a later phase',
        );
        return;
      }
      await writeJson(request.response, HttpStatus.ok, fixture);
    }
  ```

## Constraints

- `kRoutes` holds all 54 rows of `docs/api/operations.md`, both `routed` and `stubbed`. A `stubbed`
  path answers `501` on the real daemon, so a mock that answered `404` for it would be wrong in the
  other direction. `docs/api/operations.md:11-13` fixes the three outcomes: a fixture is `live`, a
  declared row with no handler is `501`, and a path absent from the table is `404`.
- A parameter segment matches **by kind**, never by a universal rule. `:hash` is the
  `algorithm:hex` form of `docs/api/conventions.md:131-154`. Every other parameter is an entity
  prefix, an underscore and a 26-character Crockford ULID, per `docs/api/conventions.md:33-56`. A
  segment that fails its kind matches no route and therefore answers `404`.
- `matchRoute` walks `kRoutes` in declaration order and returns the first match. `/v1/repository/inspect`
  precedes `/v1/repository/:id` in the list, and `inspect` fails the ULID rule anyway, so the order
  is not load-bearing — do not reorder it to make it so.
- The fixture holds the response body only. It is not the whole example file, because the example
  nests `success` and `error` and the daemon serves one of them at a time.
- Four default fixtures, not 23. Only `system.health` and `system.db` have a resource method after
  EPIC 001, and `event.list` plus `node.list` back the cursor and the `blocked-node` scenario. EPIC
  006 adds the rest. A routed operation with no fixture is the `501` case G2 requires, so an
  incomplete fixture set is the design, not a gap.
- `loadFixture` reads from disk on every call, relative to the package root. `flutter test` runs
  with the package root as the working directory.

## Tasks

### Task 003.1 — the routing test

**Input:** `test/mock_daemon/contract_enforcement_test.dart`, `test/mock_daemon/fixtures.dart`,
`test/mock_daemon/routes.dart`, the four fixture files

**Action — RED:** extend `test/mock_daemon/contract_enforcement_test.dart`. Add the imports
`fixtures.dart` and `routes.dart`. Drive every request through `probe` from `http_probe.dart`.

Group `kRoutes`:

- `'should match the published operation table when the routes are read'` — parse
  `docs/api/operations.md` with
  `RegExp(r'^\|\s*`([\w.]+)`\s*\|\s*`([A-Z]+) ([^`]+)`\s*\|\s*(\d+)\s*\|\s*(routed|stubbed)\s*\|')`over`File('docs/api/operations.md').readAsLinesSync()`. Build the expected set of
`'<operation> <METHOD> <template> <declared>'`strings, build the same set from`kRoutes`, and
assert they are equal. The published document is the authority, so a transcription error in
`kRoutes` fails here.
- `'should hold every declared operation when the routes are counted'` — assert `kRoutes.length`
  equals `54`.
- `'should hold the routed operations when the routes are counted'` — assert
  `kRoutes.where((route) => route.declared == 'routed').length` equals `24`.
- `'should declare query keys for the event log only when the routes are read'` — assert the only
  route with a non-empty `queryKeys` is `event.list`, and that its set equals `kEventQueryKeys`.

Group `matchRoute`:

- `'should match the operation when the path is a literal'` — assert
  `matchRoute('GET', '/v1/health')!.route.operation` equals `'system.health'`.
- `'should return null when the method does not match'` — assert
  `matchRoute('POST', '/v1/health')` is null.
- `'should capture the id when the path carries a prefixed ULID'` — assert
  `matchRoute('GET', '/v1/node/task_01JQ8Z7G3HZZZZZZZZZZZZZZZZ')!.parameters['id']` equals
  `'task_01JQ8Z7G3HZZZZZZZZZZZZZZZZ'`.
- `'should return null when the id is not a prefixed ULID'` — assert
  `matchRoute('GET', '/v1/node/not-a-ulid')` is null.
- `'should return null when the id carries no entity prefix'` — assert
  `matchRoute('GET', '/v1/node/01JQ8Z7G3HZZZZZZZZZZZZZZZZ')` is null.
- `'should capture the hash when the path carries the algorithm form'` — assert
  `matchRoute('GET', '/v1/blob/sha256:abc123')!.parameters['hash']` equals `'sha256:abc123'`.
- `'should return null when the hash carries no algorithm'` — assert
  `matchRoute('GET', '/v1/blob/abc123')` is null.
- `'should return null when a prefixed ULID is used as a blob hash'` — assert
  `matchRoute('GET', '/v1/blob/repo_01JQ8Z7G3HZZZZZZZZZZZZZZZZ')` is null. This is the assertion
  that proves one universal ULID rule was not used.

Group `loadFixture`:

- `'should return the published success body when the operation has a fixture'` — assert
  `loadFixture('system.health')` equals the `success` object of
  `docs/api/contract/examples/system.health.json`.
- `'should return null when the operation has no fixture'` — assert `loadFixture('project.list')` is
  null.

Group `MockDaemon`, nested group `routing`:

- `'should answer the fixture when a routed operation has one'` — `GET`
  `'${daemon.baseUrl}/v1/health'`, assert the status is `200` and the body equals the
  `system.health` fixture.
- `'should answer not-implemented when a routed operation has no fixture'` — `GET` `'/v1/project'`,
  assert the status is `501` and the error `code` is `'not-implemented'`.
- `'should answer not-implemented when a stubbed operation is called'` — `GET` `'/v1/worker'`,
  assert the status is `501` and the error `code` is `'not-implemented'`.
- `'should answer not-found when the path is absent from the table'` — `GET` `'/v1/nope'`, assert
  the status is `404` and the error `code` is `'not-found'`.
- `'should answer not-found when a path parameter fails its kind'` — `GET`
  `'/v1/node/not-a-ulid'`, assert the status is `404`.
- `'should answer not-implemented when a blob hash matches its kind'` — `GET`
  `'/v1/blob/sha256:abc123'`, assert the status is `501`. `blob.show` is routed and carries no
  fixture.

**Action — GREEN:** the same role writes `routes.dart`, `fixtures.dart`, the four fixture files and
the `_handle` replacement, then re-runs the file.

## Verify

- `make test-one T=test/mock_daemon/contract_enforcement_test.dart` exits 0.
- `make test-one T=test/mock_daemon/mock_daemon_test.dart` exits 0. Update the Story 01 test
  `'should answer a request when the daemon is running'` — `/v1/health` now answers `200`, not
  `404`. Change that one expectation and change nothing else in the file.
- `make verify` exits 0.
- Proof: none of its own. It is one third of `PASS 004-G2-ENFORCEMENT`, which Story 04 delivers.
