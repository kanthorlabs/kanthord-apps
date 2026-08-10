# Story 01 — `MockDaemon`

Epic: `.agent/plan/epics/004-mock-daemon-and-contract-suite.md`
Depends on: none. It is the first Story of the EPIC.

**Both Tasks are the test-engineer lane.** Every file this Story writes is under `test/`, so the
software-engineer opens nothing. Read `scripts/lane-check.sh:77-84`.

## Change

- New `test/mock_daemon/mock_daemon.dart`:

  ```dart
  import 'dart:async';
  import 'dart:convert';
  import 'dart:io';

  const String kMockDaemonToken = 'mock-daemon-token';

  final class RecordedRequest {
    const RecordedRequest({
      required this.method,
      required this.path,
      required this.query,
      required this.headers,
      required this.body,
    });

    final String method;
    final String path;
    final Map<String, String> query;
    final Map<String, String> headers;
    final String body;
  }

  final class MockDaemon {
    MockDaemon._(this._server);

    static Future<MockDaemon> start() async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      final daemon = MockDaemon._(server);
      unawaited(daemon._serve());
      return daemon;
    }

    final HttpServer _server;
    final List<RecordedRequest> requests = <RecordedRequest>[];
    final List<Object> handlerErrors = <Object>[];

    int get port => _server.port;

    String get baseUrl => 'http://127.0.0.1:$port';

    Future<void> stop() => _server.close(force: true);

    Future<void> _serve() async {
      await for (final request in _server) {
        try {
          final body = await utf8.decoder.bind(request).join();
          requests.add(_record(request, body));
          await _handle(request);
        } on Object catch (error) {
          handlerErrors.add(error);
          try {
            request.response.statusCode = HttpStatus.internalServerError;
            await request.response.close();
          } on Object catch (_) {}
        }
      }
    }

    RecordedRequest _record(HttpRequest request, String body) {
      final headers = <String, String>{};
      request.headers.forEach((name, values) {
        headers[name] = values.join(',');
      });
      return RecordedRequest(
        method: request.method,
        path: request.uri.path,
        query: Map<String, String>.of(request.uri.queryParameters),
        headers: headers,
        body: body,
      );
    }

    Future<void> _handle(HttpRequest request) async {
      request.response.statusCode = HttpStatus.notFound;
      await request.response.close();
    }
  }
  ```

- New `test/mock_daemon/http_probe.dart`. Every test in this EPIC drives the daemon through these
  two functions and never builds an `HttpClient` inline, so no test improvises a request, a
  tear-down or a body drain:

  ```dart
  import 'dart:convert';
  import 'dart:io';

  import 'mock_daemon.dart';

  final class Probe {
    const Probe({
      required this.status,
      required this.headers,
      required this.text,
      required this.body,
    });

    final int status;
    final Map<String, String> headers;
    final String text;
    final Map<String, dynamic> body;
  }

  Future<HttpClientResponse> openProbe(
    String url, {
    String method = 'GET',
    String? token = kMockDaemonToken,
    String? rawAuthorization,
    String? requestBody,
  }) async {
    final client = HttpClient();
    final request = await client.openUrl(method, Uri.parse(url));
    if (rawAuthorization != null) {
      request.headers.set(HttpHeaders.authorizationHeader, rawAuthorization);
    } else if (token != null) {
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
    }
    if (requestBody != null) {
      request.write(requestBody);
    }
    return request.close();
  }

  Future<Probe> probe(
    String url, {
    String method = 'GET',
    String? token = kMockDaemonToken,
    String? rawAuthorization,
    String? requestBody,
  }) async {
    final response = await openProbe(
      url,
      method: method,
      token: token,
      rawAuthorization: rawAuthorization,
      requestBody: requestBody,
    );
    final text = await utf8.decoder.bind(response).join();
    final headers = <String, String>{};
    response.headers.forEach((name, values) {
      headers[name] = values.join(',');
    });
    return Probe(
      status: response.statusCode,
      headers: headers,
      text: text,
      body: text.isEmpty ? <String, dynamic>{} : jsonDecode(text) as Map<String, dynamic>,
    );
  }
  ```

## Constraints

- `HttpServer.bind(InternetAddress.loopbackIPv4, 0)`. Port `0` is the whole point: the operating
  system assigns a free port, so two daemons never collide. No test names a port literal.
- `stop()` is `close(force: true)`. A held keep-alive connection must not hang the tear-down.
- `_serve()` is started with `unawaited`, never awaited. `start()` returns after the bind, not after
  the server stops.
- The request body is drained and recorded before `_handle` runs. An undrained body blocks the next
  request on a keep-alive connection. **So the drain, not the bearer check, is the first stage of
  the pipeline.** Every later Story that says a check runs "first" means first inside `_handle`.
  State it that way and do not claim the daemon answers `401` before it reads the body.
- `_serve()` wraps every request in a `try`. A handler that throws must not end the accept loop, and
  must not become an unhandled asynchronous error out of the `unawaited` future. The error is
  recorded in `handlerErrors` and the connection gets a bare `500`, so a test can assert both that
  the daemon survived and that nothing threw silently.
- `handlerErrors` must be empty at the end of every test that expects a clean run. A `500` from this
  boundary is a mock defect, never a contract behavior — `docs/api/errors.md` reserves
  `internal-error` for the daemon, and this path writes no envelope precisely so it cannot be
  mistaken for one.
- `requests` and `handlerErrors` are public and append-only. Story 08 asserts against `requests`.
- `_handle` answers `404` with an empty body in this Story only. Story 02 replaces those two lines
  with the envelope writer.
- `dart:io` is legal here. `test/**` never reaches a web bundle, and `scripts/arch-check.sh:11-19`
  scans `lib` only.
- Add no dependency. `pubspec.yaml` is denied to every role by `scripts/lane-check.sh:41`.

## Tasks

### Task 001.1 — the server lifecycle test

**Input:** `test/mock_daemon/mock_daemon_test.dart`, `test/mock_daemon/http_probe.dart`

**Action — RED:** write the file. Import `dart:io`, `package:flutter_test/flutter_test.dart`,
`http_probe.dart` and `mock_daemon.dart`. Every test registers `addTearDown(daemon.stop)`
immediately after the start, drives the daemon through `probe`, and marks its three sections with
`// Arrange`, `// Act` and `// Assert` — `docs/testing.md:18-19` allows those three comments and no
others.

Group `MockDaemon`, nested group `start`:

- `'should assign a port when the daemon starts'` — assert `daemon.port` is greater than `0`.
- `'should report the loopback base URL when the daemon starts'` — assert `daemon.baseUrl` equals
  `'http://127.0.0.1:${daemon.port}'`.
- `'should take two different ports when two daemons start at once'` — start two daemons, register a
  tear-down for each, assert `first.port` is not equal to `second.port`. This is the EPIC hermetic
  bullet.
- `'should answer a request when the daemon is running'` — `probe('${daemon.baseUrl}/v1/health')`,
  assert the status is `404`. The route table lands in Story 03.

Nested group `stop`:

- `'should refuse a connection when the daemon is stopped'` — start a daemon, `await daemon.stop()`,
  then assert `probe(daemon.baseUrl)` throws. Use
  `await expectLater(probe(daemon.baseUrl), throwsA(isA<SocketException>()))`.

Nested group `handlerErrors`:

- `'should record nothing when a request is answered'` — `probe('/v1/health')`, assert
  `daemon.handlerErrors` is empty.
- `'should answer a second request when a first request is answered'` — `probe('/v1/health')` twice
  on one daemon, assert both statuses are `404` and `daemon.requests.length` is `2`. This proves the
  accept loop is a loop and not a one-shot.

Story 07 proves the error boundary itself, with the `truncated` scenario as the trigger. Story 01
has no deterministic way to make a handler throw, so it asserts only that nothing throws on the
happy path.

Nested group `requests`:

- `'should record the method and the path when a request arrives'` — `GET` `'/v1/health'`, assert
  `daemon.requests.single.method` equals `'GET'` and `.path` equals `'/v1/health'`.
- `'should record the query when a request carries one'` — `GET` `'/v1/event?limit=5'`, assert
  `daemon.requests.single.query` equals `<String, String>{'limit': '5'}`.
- `'should record the body when a request carries one'` — `probe(…, method: 'POST', requestBody:
'{"name":"atlas"}')` against `'/v1/project'`, assert `daemon.requests.single.body` equals
  `'{"name":"atlas"}'`.
- `'should record an empty body when a request carries none'` — `GET` `'/v1/health'`, assert
  `daemon.requests.single.body` is empty. Story 08 asserts the same thing through the suite.
- `'should record the header in lower case when a request carries one'` — send
  `Authorization: Bearer $kMockDaemonToken`, assert
  `daemon.requests.single.headers['authorization']` equals `'Bearer $kMockDaemonToken'`. `dart:io`
  lower-cases every received header name, and Story 08 depends on that.

**Action — GREEN:** the same role writes `test/mock_daemon/mock_daemon.dart` as the `## Change`
section states, then re-runs the file.

## Verify

- `make test-one T=test/mock_daemon/mock_daemon_test.dart` exits 0.
- `make arch-check` exits 0. The rule set scans `lib` only, so this Story cannot move it.
- `make verify` exits 0.
- Proof: `PASS 004-G1-SERVER`.
