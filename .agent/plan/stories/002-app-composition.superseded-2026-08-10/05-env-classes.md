# Story 05 — the env classes and `.env.example`

Epic: `.agent/plan/epics/002-app-composition.md`
Depends on: Story 02 (`PreferencesBaseUrlProvider` exists, so the prefill-not-fallback test has a
store to read).

## Change

### Human pre-step — `.env.example`. **APPLIED**

`.env.example` sits at the repository root. `scripts/lane-check.sh:91` denies every path outside
`lib/`, `assets/`, `test/`, `integration_test/`, `scripts/` and `.agent/tdd/`, so the human applied
it. Commit `c127229` created the file with the key `API_BASE_URL`; the owner renamed the key on
2026-08-10. It holds one line:

```
KANTHORD_API_ENDPOINT=http://localhost:31415
```

**`KANTHORD_API_ENDPOINT` is the one key name for every environment file.** `.env.example` carries
the development value, `http://localhost:31415`. `.env.staging` and `.env.production` carry their
own endpoint under the same key, and a later EPIC adds the class that reads each. This EPIC ships
the development class alone, which is what G5 scopes.

`.gitignore:17-18` already reads `.env*` then `!.env.example`, so the example is committed and the
per-developer files are not. No `.gitignore` change is needed.

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

The software-engineer runs `make generate-lib` after writing `lib/app/env/env.dart`. The expected
diff adds `lib/app/env/env.g.dart`, and that file is committed. `build.yaml:26-29` already points
`envied_generator` at `lib/app/env/**.dart`, so no config change is needed. Never `make generate`.

## Constraints

- **The generator reads `.env.example`, the committed file, and never `.env`.** `.env` is
  gitignored and per-developer, so a generator pointed at it makes the committed `env.g.dart`
  developer-dependent: two developers generate two different committed files, and
  `test/app/env_test.dart` fails for whoever holds a different value. `.env.example` is the only
  input that makes `make generate-lib` reproducible across clones, which is what G5 calls the
  reproducible artifact.
- A developer who wants a different daemon address types it into the connect field. The base URL is
  a runtime value by design, so no per-developer build-time override is needed.
- `Envied.requireEnvFile` defaults to `false` in `envied` 1.3.8, and `EnviedField.defaultValue`
  supplies the value when the key is absent. The default is therefore a second guard and not the
  primary mechanism: `.env.example` is committed, so the key is always present.
- One field and one key. `Env.apiEndpoint` holds the endpoint prefill and nothing else.
- No token, no secret and no credential in `.env.example`, in `.env` or in `Env`. A web build ships
  readable JavaScript.
- **The value is a prefill, never the address the client calls.** EPIC 002 G3 and EPIC 003 both
  require the human to confirm the endpoint before a request leaves, and a stored value always wins.
  A production build therefore opens the connect field on the production endpoint; it sends nothing
  to it unconfirmed.
- `Env` is referenced by no file in this EPIC. EPIC 003 reads it into the connect field.
  `lib/app/settings/base_url_store.dart` never imports it, and `lib/api/` never imports it.
- No comment in the file.

## Tasks

### Task 005.1 — the env test

**Input:** `test/app/env_test.dart`

**Action — RED:** write the file verbatim.

```dart
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/app/env/env.dart';
import 'package:kanthord/app/settings/base_url_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
  TestWidgetsFlutterBinding.ensureInitialized();

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

      test('should declare the endpoint key when the example is read', () {
        // Arrange
        final entries = _readExample();

        // Act
        final keys = entries.keys.toList();

        // Assert
        expect(keys, <String>[_kEndpointKey]);
      });
    });

    group('prefill', () {
      test('should return null from the store when the store is empty and the env default '
          'exists', () async {
        // Arrange
        SharedPreferences.setMockInitialValues(<String, Object>{});
        final store = PreferencesBaseUrlProvider(await SharedPreferences.getInstance());

        // Act
        final result = await store.read();

        // Assert
        expect(Env.apiEndpoint, isNotEmpty);
        expect(result, isNull);
      });

      test('should reference the env class nowhere in the store when the source is read', () {
        // Arrange
        final source = File('lib/app/settings/base_url_store.dart').readAsStringSync();

        // Act
        final mentionsEnv = source.contains('Env.') || source.contains('env/env.dart');

        // Assert
        expect(mentionsEnv, isFalse);
      });
    });
  });
}
```

**Action — GREEN:** the software-engineer's Task 005.2 creates the seam.

### Task 005.2 — the env class

**Input:** `lib/app/env/env.dart`

**Action — GREEN:** write the file exactly as the `## Change` section states, then run
`make generate-lib` and commit `lib/app/env/env.g.dart`.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/app/env_test.dart` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: `PASS 002-G5-ENV`.
