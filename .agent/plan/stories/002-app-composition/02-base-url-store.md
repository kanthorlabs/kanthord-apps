# Story 02 — the base URL store

Epic: `.agent/plan/epics/002-app-composition.md`
Depends on: EPIC 001 Story 02 (`lib/api/base_url_provider.dart` exists).

## Change

- New `lib/app/settings/base_url_store.dart`:

  ```dart
  import 'package:shared_preferences/shared_preferences.dart';

  import '../../api/base_url_provider.dart';

  abstract class BaseUrlStoreType implements BaseUrlProviderType {
    Future<String?> read();
    Future<void> save(String value);
    Future<void> clear();
  }

  final class PreferencesBaseUrlProvider implements BaseUrlStoreType {
    const PreferencesBaseUrlProvider(this._preferences);

    static const String storageKey = 'kanthord.base_url';

    final SharedPreferences _preferences;

    @override
    Future<String?> read() async => _preferences.getString(storageKey);

    @override
    Future<void> save(String value) => _preferences.setString(storageKey, value);

    @override
    Future<void> clear() => _preferences.remove(storageKey);

    @override
    Future<String> baseUrl() async {
      final value = _preferences.getString(storageKey);
      if (value == null) {
        throw StateError('the base URL is not configured');
      }
      return value;
    }
  }
  ```

## Constraints

- `BaseUrlStoreType` extends the SDK interface instead of replacing it. `ApiConfig` keeps taking a
  `BaseUrlProviderType`, and EPIC 003 takes `BaseUrlStoreType` when it needs `save`.
- `baseUrl()` invents no value. It throws when the key is absent. The unset case is read through
  `read()`, which returns null, and the app renders that state.
- **`StateError` is a programming-error signal, not a user-facing state.** No production path calls
  `baseUrl()` before the store holds a value: `BootPage` calls `read()`, and EPIC 003 probes a
  candidate `KanthordApi` built over the entered value. A `StateError` reaching a bloc therefore
  means a caller skipped the unset state, and it must stay a crash rather than become an
  `ApiException`. `ApiException` describes what the daemon answered, and this describes a client
  mistake. Read the open item in `index.md` before widening it.
- The file declares no `http://localhost:31415` and no other host. The convention reaches the human
  through `lib/app/env/` in Story 05 and through the EPIC 003 connect field.
- The file holds no token. `SecureStorageTokenProvider` and `MemoryTokenProvider` own the token.
- No comment in the file.

## Tasks

### Task 002.1 — the base URL store test

**Input:** `test/app/settings/base_url_store_test.dart`

**Action — RED:** write the file verbatim.

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/base_url_provider.dart';
import 'package:kanthord/app/settings/base_url_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late SharedPreferences preferences;
  late PreferencesBaseUrlProvider store;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    preferences = await SharedPreferences.getInstance();
    store = PreferencesBaseUrlProvider(preferences);
  });

  group('PreferencesBaseUrlProvider', () {
    group('read', () {
      test('should return null when nothing was ever written', () async {
        // Arrange
        // the store is empty

        // Act
        final result = await store.read();

        // Assert
        expect(result, isNull);
      });
    });

    group('save', () {
      test('should return the saved value when save was called', () async {
        // Arrange
        const value = 'http://127.0.0.1:31415';

        // Act
        await store.save(value);

        // Assert
        expect(await store.read(), value);
      });

      test('should write under the namespaced key when save was called', () async {
        // Arrange
        const value = 'http://127.0.0.1:31415';

        // Act
        await store.save(value);

        // Assert
        expect(PreferencesBaseUrlProvider.storageKey, 'kanthord.base_url');
        expect(preferences.getString(PreferencesBaseUrlProvider.storageKey), value);
      });
    });

    group('clear', () {
      test('should return null when clear was called', () async {
        // Arrange
        await store.save('http://127.0.0.1:31415');

        // Act
        await store.clear();

        // Assert
        expect(await store.read(), isNull);
      });
    });

    group('baseUrl', () {
      test('should throw a StateError when nothing was ever written', () async {
        // Arrange
        // the store is empty

        // Act
        Future<String> act() => store.baseUrl();

        // Assert
        expect(act, throwsA(isA<StateError>()));
      });

      test('should return the saved value when save was called', () async {
        // Arrange
        const value = 'http://localhost:31415';
        await store.save(value);

        // Act
        final result = await store.baseUrl();

        // Assert
        expect(result, value);
      });
    });

    group('type', () {
      test('should satisfy the SDK provider interface when the store is registered', () {
        // Arrange
        // the store is built in setUp

        // Act
        final result = store;

        // Assert
        expect(result, isA<BaseUrlProviderType>());
        expect(result, isA<BaseUrlStoreType>());
      });
    });
  });
}
```

**Action — GREEN:** the software-engineer's Task 002.2 creates the seam.

### Task 002.2 — the store

**Input:** `lib/app/settings/base_url_store.dart`

**Action — GREEN:** write the file exactly as the `## Change` section states.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/app/settings` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: `PASS 002-G3-BASE-URL-STORE`.
