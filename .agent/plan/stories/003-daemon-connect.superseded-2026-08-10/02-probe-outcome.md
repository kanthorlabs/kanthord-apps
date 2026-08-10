# Story 02 — the probe outcome map

Epic: `.agent/plan/epics/003-daemon-connect.md`
Depends on: Story 01 (`ConnectState`).

## Change

### `lib/**`

New file `lib/features/daemon_connect/connect/probe_outcome.dart`, verbatim:

```dart
import '../../../api/api.dart';
import 'connect_state.dart';

const String kAllowedHostsKey = 'KANTHORD_HTTP_ALLOWED_HOSTS';
const String kAllowedOriginsKey = 'KANTHORD_HTTP_ALLOWED_ORIGINS';

const Set<String> _kDaemonConfigCodes = <String>{'host-forbidden', 'origin-forbidden'};

ConnectState probeFailure(
  ApiException error, {
  required String baseUrl,
  required String token,
  required bool isWeb,
}) {
  if (error is ApiUnauthorizedException) {
    return ConnectState.tokenRejected(baseUrl: baseUrl, token: token, detail: error.message);
  }
  if (error is ApiResponseException && _kDaemonConfigCodes.contains(error.code)) {
    return ConnectState.daemonRejected(
      baseUrl: baseUrl,
      token: token,
      code: error.code,
      host: Uri.parse(baseUrl).authority,
      configKey: error.code == 'origin-forbidden' ? kAllowedOriginsKey : kAllowedHostsKey,
    );
  }
  return ConnectState.unreachable(
    baseUrl: baseUrl,
    token: token,
    detail: error.message,
    isOpaque: isWeb && error is ApiNoNetworkException,
  );
}
```

### The truth table this function fixes

| Input                                              | Result                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| `ApiUnauthorizedException` (`401 unauthenticated`) | `ConnectTokenRejected(detail: error.message)`                     |
| `ApiResponseException(code: 'host-forbidden')`     | `ConnectDaemonRejected(configKey: KANTHORD_HTTP_ALLOWED_HOSTS)`   |
| `ApiResponseException(code: 'origin-forbidden')`   | `ConnectDaemonRejected(configKey: KANTHORD_HTTP_ALLOWED_ORIGINS)` |
| `ApiNoNetworkException`, `isWeb: false`            | `ConnectUnreachable(isOpaque: false)`                             |
| `ApiNoNetworkException`, `isWeb: true`             | `ConnectUnreachable(isOpaque: true)`                              |
| `ApiTimeoutException`                              | `ConnectUnreachable(isOpaque: false)`                             |
| `ApiDecodeException`                               | `ConnectUnreachable(isOpaque: false)`                             |
| `ApiCancelledException`                            | `ConnectUnreachable(isOpaque: false)`                             |
| `ApiNotImplementedException`                       | `ConnectUnreachable(isOpaque: false)`                             |
| any other `ApiResponseException` code              | `ConnectUnreachable(isOpaque: false)`                             |

`isOpaque` is `true` for `ApiNoNetworkException` on web alone. A `401` and a `403` reach the browser
with a status and a body, so they keep their own outcome on every platform.
`.agent/plan/stories/001-transport-foundation/04-web-opaque-failure-message.md:34-35`.

### `test/**`

New file `test/features/daemon_connect/connect/probe_outcome_test.dart`, verbatim:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/api_exception.dart';
import 'package:kanthord/api/models/health.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_state.dart';
import 'package:kanthord/features/daemon_connect/connect/probe_outcome.dart';

const String _kBaseUrl = 'http://localhost:31415';
const String _kToken = 'a-token';

const Map<String, dynamic> _kHealthBody = <String, dynamic>{
  'status': 'ok',
  'dependencies': <dynamic>[],
};

ConnectState _map(ApiException error) =>
    probeFailure(error, baseUrl: _kBaseUrl, token: _kToken, isWeb: false);

void main() {
  group('the four probe outcomes', () {
    group('the proven outcome', () {
      test('should be the connected state when the daemon answers 200', () {
        // Arrange
        final health = Health.fromJson(_kHealthBody);

        // Act
        final state = ConnectState.connected(
          baseUrl: _kBaseUrl,
          token: _kToken,
          health: health,
        );

        // Assert
        expect(state, isA<ConnectConnected>());
        expect((state as ConnectConnected).health.status.raw, 'ok');
        expect(state.baseUrl, _kBaseUrl);
        expect(state.token, _kToken);
      });

      test('should never come from the failure map when the daemon answers 200', () {
        // Arrange
        const error = ApiUnauthorizedException('the daemon refused the token');

        // Act
        final state = _map(error);

        // Assert
        expect(state, isNot(isA<ConnectConnected>()));
      });
    });
  });

  group('probeFailure', () {
    group('the token outcome', () {
      test('should name the token when the daemon answers unauthenticated', () {
        // Arrange
        const error = ApiUnauthorizedException('the daemon refused the token');

        // Act
        final state = _map(error);

        // Assert
        expect(state, isA<ConnectTokenRejected>());
        expect((state as ConnectTokenRejected).detail, 'the daemon refused the token');
        expect(state.baseUrl, _kBaseUrl);
        expect(state.token, _kToken);
      });
    });

    group('the daemon configuration outcome', () {
      test('should name the host allow list when the code is host-forbidden', () {
        // Arrange
        const error = ApiResponseException(
          status: 403,
          code: 'host-forbidden',
          message: 'the daemon refused the Host header localhost:31415.',
        );

        // Act
        final state = _map(error);

        // Assert
        expect(state, isA<ConnectDaemonRejected>());
        expect((state as ConnectDaemonRejected).code, 'host-forbidden');
        expect(state.host, 'localhost:31415');
        expect(state.configKey, 'KANTHORD_HTTP_ALLOWED_HOSTS');
      });

      test('should name the origin allow list when the code is origin-forbidden', () {
        // Arrange
        const error = ApiResponseException(
          status: 403,
          code: 'origin-forbidden',
          message: 'the request carried an Origin header',
        );

        // Act
        final state = _map(error);

        // Assert
        expect(state, isA<ConnectDaemonRejected>());
        expect((state as ConnectDaemonRejected).code, 'origin-forbidden');
        expect(state.host, 'localhost:31415');
        expect(state.configKey, 'KANTHORD_HTTP_ALLOWED_ORIGINS');
      });

      test('should not take the daemon outcome when the code is any other code', () {
        // Arrange
        const error = ApiResponseException(
          status: 503,
          code: 'service-unavailable',
          message: 'the daemon is shutting down',
        );

        // Act
        final state = _map(error);

        // Assert
        expect(state, isA<ConnectUnreachable>());
        expect((state as ConnectUnreachable).detail, 'the daemon is shutting down');
        expect(state.isOpaque, isFalse);
      });
    });

    group('the URL outcome', () {
      test('should name the URL when the connection fails', () {
        // Arrange
        const error = ApiNoNetworkException('no answer from the daemon at localhost:31415.');

        // Act
        final state = _map(error);

        // Assert
        expect(state, isA<ConnectUnreachable>());
        expect(
          (state as ConnectUnreachable).detail,
          'no answer from the daemon at localhost:31415.',
        );
        expect(state.isOpaque, isFalse);
      });

      test('should stay the URL outcome when the daemon does not answer in time', () {
        // Arrange
        const error = ApiTimeoutException('the daemon did not answer in time');

        // Act
        final state = _map(error);

        // Assert
        expect(state, isA<ConnectUnreachable>());
        expect((state as ConnectUnreachable).isOpaque, isFalse);
      });

      test('should stay the URL outcome when the body does not decode', () {
        // Arrange
        const error = ApiDecodeException('the daemon answered a body that is not an object');

        // Act
        final state = _map(error);

        // Assert
        expect(state, isA<ConnectUnreachable>());
      });

      test('should stay the URL outcome when the request is cancelled', () {
        // Arrange
        const error = ApiCancelledException('the request was cancelled');

        // Act
        final state = _map(error);

        // Assert
        expect(state, isA<ConnectUnreachable>());
      });

      test('should stay the URL outcome when the route is not implemented', () {
        // Arrange
        const error = ApiNotImplementedException('the daemon does not implement this route');

        // Act
        final state = _map(error);

        // Assert
        expect(state, isA<ConnectUnreachable>());
      });
    });
  });
}
```

New file `test/features/daemon_connect/connect/probe_outcome_web_test.dart`, verbatim:

```dart
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/api_exception.dart';
import 'package:kanthord/features/daemon_connect/connect/connect_state.dart';
import 'package:kanthord/features/daemon_connect/connect/probe_outcome.dart';

const String _kBaseUrl = 'http://localhost:31415';
const String _kToken = 'a-token';

ApiException _connectionFailure({required bool isWeb}) => ApiException.fromDio(
  DioException(
    requestOptions: RequestOptions(path: '/v1/health', baseUrl: _kBaseUrl),
    type: DioExceptionType.connectionError,
  ),
  isWeb: isWeb,
);

ConnectState _map(ApiException error, {required bool isWeb}) =>
    probeFailure(error, baseUrl: _kBaseUrl, token: _kToken, isWeb: isWeb);

void main() {
  group('probeFailure on web', () {
    group('the URL outcome', () {
      test('should name the four opaque causes and the two config keys when the connection '
          'fails on web', () {
        // Arrange
        final error = _connectionFailure(isWeb: true);

        // Act
        final state = _map(error, isWeb: true);

        // Assert
        expect(state, isA<ConnectUnreachable>());
        final unreachable = state as ConnectUnreachable;
        expect(unreachable.isOpaque, isTrue);
        expect(unreachable.detail, contains('the daemon is down'));
        expect(unreachable.detail, contains('the origin is rejected'));
        expect(unreachable.detail, contains('the host is rejected'));
        expect(unreachable.detail, contains('DNS failed'));
        expect(unreachable.detail, contains('KANTHORD_HTTP_ALLOWED_ORIGINS'));
        expect(unreachable.detail, contains('KANTHORD_HTTP_ALLOWED_HOSTS'));
      });

      test('should claim one cause when the connection fails on native', () {
        // Arrange
        final error = _connectionFailure(isWeb: false);

        // Act
        final state = _map(error, isWeb: false);

        // Assert
        expect(state, isA<ConnectUnreachable>());
        final unreachable = state as ConnectUnreachable;
        expect(unreachable.isOpaque, isFalse);
        expect(unreachable.detail, 'no answer from the daemon at localhost:31415.');
      });
    });

    group('the outcomes web does not collapse', () {
      test('should keep the token outcome when the daemon answers 401 on web', () {
        // Arrange
        const error = ApiUnauthorizedException('the daemon refused the token');

        // Act
        final state = _map(error, isWeb: true);

        // Assert
        expect(state, isA<ConnectTokenRejected>());
      });

      test('should keep the daemon outcome when the daemon answers 403 on web', () {
        // Arrange
        const error = ApiResponseException(
          status: 403,
          code: 'origin-forbidden',
          message: 'the request carried an Origin header',
        );

        // Act
        final state = _map(error, isWeb: true);

        // Assert
        expect(state, isA<ConnectDaemonRejected>());
        expect((state as ConnectDaemonRejected).configKey, 'KANTHORD_HTTP_ALLOWED_ORIGINS');
      });
    });
  });
}
```

## Constraints

- `probeFailure` is a top-level function. It builds no widget, reads no store and calls no daemon.
- It never inspects `ApiResponseException.status`. It branches on `code` alone.
  `docs/api/errors.md:18` — "Branch on `code`. Never parse `message`."
- `host` comes from `Uri.parse(baseUrl).authority`, never from the response body. The
  `host-forbidden` schema carries no `details` (`docs/api/contract/features/system.yaml:118-129`).
- `host` is **the daemon host the client sent**, and it is the value to add for `host-forbidden`
  only. For `origin-forbidden` the value to add is the page origin, such as
  `http://localhost:8080`, which is a different value (`docs/api/connectivity.md:121-123`). Story 08
  therefore renders two different sentences and never tells the operator to add `host` to
  `KANTHORD_HTTP_ALLOWED_ORIGINS`.
- Neither test file imports `dart:io`, so both run under `flutter test --platform chrome`.

## Verify

- `make test-one T=test/features/daemon_connect/connect/probe_outcome_test.dart` exits 0.
- `make test-one T=test/features/daemon_connect/connect/probe_outcome_web_test.dart` exits 0.
- `make verify` exits 0.
- Proof: `PASS 003-G4-OUTCOMES` and `PASS 003-G5-WEB-MESSAGE`.

## Tasks

### Task 002.1 — the outcome tests

**Input:** `test/features/daemon_connect/connect/probe_outcome_test.dart`,
`test/features/daemon_connect/connect/probe_outcome_web_test.dart`

**Action — RED:** write both files verbatim.

**Action — GREEN:** Task 002.2 creates the seam.

### Task 002.2 — the outcome map

**Input:** `lib/features/daemon_connect/connect/probe_outcome.dart`

**Action — GREEN:** write the file verbatim.

**Action — REFACTOR:** none.
