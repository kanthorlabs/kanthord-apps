# Story 02 — the env classes and `.env.example`

Epic: `.agent/plan/epics/002-app-composition.md`
Depends on: none. It stands before Story `05`, because the registry seed of G5 imports `Env`.

## Change

### Human pre-step — `.env.example`. **APPLIED**

`scripts/lane-check.sh:91` denies every path outside `lib/`, `assets/`, `test/`, `integration_test/`,
`scripts/` and `.agent/tdd/`. The file is on disk and holds one line:

```
KANTHORD_API_ENDPOINT=http://localhost:31415
```

`.gitignore:17-18` reads `.env*` then `!.env.example`. No `.gitignore` change is needed.

### `lib/**`

- New `lib/app/env/env.dart`:

  ```dart
  import 'package:envied/envied.dart';

  part 'env.g.dart';

  @Envied(path: '.env.example')
  abstract class Env {
    @EnviedField(varName: 'KANTHORD_API_ENDPOINT', defaultValue: 'http://localhost:31415')
    static const String apiEndpoint = _Env.apiEndpoint;
  }
  ```

### Codegen

The software-engineer runs `make generate-lib` after writing `lib/app/env/env.dart`. The expected diff
adds `lib/app/env/env.g.dart`, and that file is committed. `build.yaml:26-29` already points
`envied_generator:envied` at `lib/app/env/**.dart`, so no config change is needed. Never
`make generate`.

## Constraints

- **`@Envied` points at `.env.example`, the committed file, never at `.env`.** `.env` is gitignored
  and per-developer, so a generator pointed at it makes the committed `env.g.dart` differ per clone.
- `Envied.requireEnvFile` defaults to `false` in `envied` 1.3.8, and `EnviedField.defaultValue` fills
  a missing key. The default is a second guard, not the mechanism.
- One field and one key. `Env.apiEndpoint` holds the endpoint and nothing else.
- No token, no secret and no credential in `.env.example` or in `Env`. A web build ships readable
  JavaScript.
- **`Env.apiEndpoint` is the G5 seed value, not a connect-field default and not a request-time
  fallback.** Story `05` is the one file in `lib/app/settings/` that may reference `Env.`, and Story
  `05` Task 005.4 holds the grep that proves it. This Story's test references no file Story `05`
  creates, so the compile order holds.
- `lib/api/` never imports `Env`.
- No comment in the file.

## Tasks

### Task 002.1 — the env test

**Input:** `test/app/env_test.dart`

**Action — RED:** write the file verbatim.

```dart
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/app/env/env.dart';

const String _kExampleFile = '.env.example';
const String _kEndpointKey = 'KANTHORD_API_ENDPOINT';

final RegExp _kCredentialName = RegExp(
  'TOKEN|SECRET|PASSWORD|CREDENTIAL|KEY',
  caseSensitive: false,
);

Map<String, String> _readExample() {
  final entries = <String, String>{};
  for (final line in File(_kExampleFile).readAsLinesSync()) {
    final trimmed = line.trim();
    if (trimmed.isEmpty || trimmed.startsWith('#')) continue;
    final split = trimmed.indexOf('=');
    entries[trimmed.substring(0, split)] = trimmed.substring(split + 1);
  }
  return entries;
}

void main() {
  group('Env', () {
    group('apiEndpoint', () {
      test('should hold the port convention when the value is read', () {
        // Arrange
        const expected = 'http://localhost:31415';

        // Act
        const result = Env.apiEndpoint;

        // Assert
        expect(result, expected);
      });

      test('should equal the committed example value when the example is read', () {
        // Arrange
        final entries = _readExample();

        // Act
        final result = entries[_kEndpointKey];

        // Assert
        expect(result, Env.apiEndpoint);
      });

      test('should hold a non empty value when the seed reads it', () {
        // Arrange
        const value = Env.apiEndpoint;

        // Act
        final isEmpty = value.isEmpty;

        // Assert
        expect(isEmpty, isFalse);
      });
    });

    group('.env.example', () {
      test('should name no key like a credential when the example is read', () {
        // Arrange
        final entries = _readExample();

        // Act
        final offenders = entries.keys.where(_kCredentialName.hasMatch).toList();

        // Assert
        expect(offenders, isEmpty);
      });

      test('should declare the endpoint key alone when the example is read', () {
        // Arrange
        final entries = _readExample();

        // Act
        final keys = entries.keys.toList();

        // Assert
        expect(keys, <String>[_kEndpointKey]);
      });
    });
  });
}
```

**Action — GREEN:** the software-engineer's Task 002.2 creates the seam.

### Task 002.2 — the env class

**Input:** `lib/app/env/env.dart`

**Action — GREEN:** write the file exactly as the `## Change` section states, then run
`make generate-lib` and keep `lib/app/env/env.g.dart`.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/app/env_test.dart` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: `PASS 002-G8-ENV`.
