# Story 03 — the cleartext warning and the usable URL rule

Epic: `.agent/plan/epics/003-daemon-connect.md`

## Change

### `lib/**` — the warning

New file `lib/features/daemon_connect/connect/cleartext_warning.dart`, verbatim:

```dart
const Set<String> _kLoopbackHosts = <String>{'localhost', '::1'};

bool isCleartextRisk(String baseUrl) {
  final uri = Uri.tryParse(baseUrl);
  if (uri == null || !uri.hasAuthority) return false;
  final host = uri.host.toLowerCase();
  if (_kLoopbackHosts.contains(host)) return false;
  if (host.startsWith('127.')) return false;
  return true;
}
```

### `lib/**` — the usable URL rule

New file `lib/features/daemon_connect/connect/base_url_rule.dart`, verbatim:

```dart
const Set<String> _kSupportedSchemes = <String>{'http', 'https'};

bool isUsableBaseUrl(String baseUrl) {
  final uri = Uri.tryParse(baseUrl);
  if (uri == null) return false;
  if (!_kSupportedSchemes.contains(uri.scheme)) return false;
  if (uri.host.isEmpty) return false;
  return true;
}
```

### `test/**`

New file `test/features/daemon_connect/connect/cleartext_warning_test.dart`, verbatim:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/features/daemon_connect/connect/cleartext_warning.dart';

void main() {
  group('isCleartextRisk', () {
    group('loopback', () {
      test('should report no risk when the host is 127.0.0.1', () {
        // Arrange
        const baseUrl = 'http://127.0.0.1:31415';

        // Act
        final risk = isCleartextRisk(baseUrl);

        // Assert
        expect(risk, isFalse);
      });

      test('should report no risk when the host is localhost', () {
        // Arrange
        const baseUrl = 'http://localhost:31415';

        // Act
        final risk = isCleartextRisk(baseUrl);

        // Assert
        expect(risk, isFalse);
      });

      test('should report no risk when the host is another 127 address', () {
        // Arrange
        const baseUrl = 'http://127.0.0.2:31415';

        // Act
        final risk = isCleartextRisk(baseUrl);

        // Assert
        expect(risk, isFalse);
      });
    });

    group('not loopback', () {
      test('should report a risk when the host is the Android emulator alias', () {
        // Arrange
        const baseUrl = 'http://10.0.2.2:31415';

        // Act
        final risk = isCleartextRisk(baseUrl);

        // Assert
        expect(risk, isTrue);
      });

      test('should report a risk when the host is a LAN address', () {
        // Arrange
        const baseUrl = 'http://192.168.1.24:31415';

        // Act
        final risk = isCleartextRisk(baseUrl);

        // Assert
        expect(risk, isTrue);
      });

      test('should report a risk when the scheme is https and the host is not loopback', () {
        // Arrange
        const baseUrl = 'https://192.168.1.24:31415';

        // Act
        final risk = isCleartextRisk(baseUrl);

        // Assert
        expect(risk, isTrue);
      });
    });

    group('an unusable value', () {
      test('should report no risk when the value has no authority', () {
        // Arrange
        const baseUrl = 'not-a-url';

        // Act
        final risk = isCleartextRisk(baseUrl);

        // Assert
        expect(risk, isFalse);
      });

      test('should report no risk when the value is empty', () {
        // Arrange
        const baseUrl = '';

        // Act
        final risk = isCleartextRisk(baseUrl);

        // Assert
        expect(risk, isFalse);
      });
    });
  });
}
```

New file `test/features/daemon_connect/connect/base_url_rule_test.dart`, verbatim:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/features/daemon_connect/connect/base_url_rule.dart';

void main() {
  group('isUsableBaseUrl', () {
    group('a usable value', () {
      test('should accept the value when the scheme is http and the host is set', () {
        // Arrange
        const baseUrl = 'http://localhost:31415';

        // Act
        final usable = isUsableBaseUrl(baseUrl);

        // Assert
        expect(usable, isTrue);
      });

      test('should accept the value when the scheme is https', () {
        // Arrange
        const baseUrl = 'https://daemon.example:31415';

        // Act
        final usable = isUsableBaseUrl(baseUrl);

        // Assert
        expect(usable, isTrue);
      });
    });

    group('an unusable value', () {
      test('should refuse the value when it is empty', () {
        // Arrange
        const baseUrl = '';

        // Act
        final usable = isUsableBaseUrl(baseUrl);

        // Assert
        expect(usable, isFalse);
      });

      test('should refuse the value when it carries no scheme', () {
        // Arrange
        const baseUrl = 'localhost:31415';

        // Act
        final usable = isUsableBaseUrl(baseUrl);

        // Assert
        expect(usable, isFalse);
      });

      test('should refuse the value when the scheme is not http or https', () {
        // Arrange
        const baseUrl = 'ftp://localhost:31415';

        // Act
        final usable = isUsableBaseUrl(baseUrl);

        // Assert
        expect(usable, isFalse);
      });

      test('should refuse the value when the host is empty', () {
        // Arrange
        const baseUrl = 'http:///v1/health';

        // Act
        final usable = isUsableBaseUrl(baseUrl);

        // Assert
        expect(usable, isFalse);
      });

      test('should refuse the value when it is not a URL at all', () {
        // Arrange
        const baseUrl = 'not a url';

        // Act
        final usable = isUsableBaseUrl(baseUrl);

        // Assert
        expect(usable, isFalse);
      });
    });
  });
}
```

## Constraints

- `10.0.2.2` warns. It is not a loopback address, and the function receives a URL with no platform
  context, so it cannot know an emulator typed it. `docs/api/auth.md:99` — "State this in the app to
  the operator when the base URL is not loopback."
- **The scheme does not exempt the warning.** The daemon serves plain HTTP and ships no certificate
  handling (`docs/api/auth.md:89-91`), so an `https` base URL is a mistake rather than a safe path.
  The rule is the one G6 states: a host that is not loopback warns.
- Both functions read the URL alone. They read no store, no platform flag and no token.
- An unparsable or authority-less value warns nothing, and `isUsableBaseUrl` refuses it, so the page
  shows no warning and blocks the probe until the human types a usable URL.
- `isUsableBaseUrl` closes risk S2 in `index.md`: `ConnectBloc` catches `ApiException` alone, and an
  unusable URL can make `Dio` raise something that is not an `ApiException` before the request
  leaves.

## Verify

- `make test-one T=test/features/daemon_connect/connect/cleartext_warning_test.dart` exits 0.
- `make test-one T=test/features/daemon_connect/connect/base_url_rule_test.dart` exits 0.
- `make verify` exits 0.
- Proof: `PASS 003-G6-CLEARTEXT`.

## Tasks

### Task 003.1 — the two rule tests

**Input:** `test/features/daemon_connect/connect/cleartext_warning_test.dart`,
`test/features/daemon_connect/connect/base_url_rule_test.dart`

**Action — RED:** write both files verbatim.

**Action — GREEN:** Task 003.2 creates the seam.

### Task 003.2 — the two rules

**Input:** `lib/features/daemon_connect/connect/cleartext_warning.dart`,
`lib/features/daemon_connect/connect/base_url_rule.dart`

**Action — GREEN:** write both files verbatim.

**Action — REFACTOR:** none.
