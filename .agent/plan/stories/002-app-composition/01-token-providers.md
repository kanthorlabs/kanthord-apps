# Story 01 — the token providers

Epic: `.agent/plan/epics/002-app-composition.md`
Depends on: EPIC 001 Story 05 (`lib/api/token_provider.dart` exists).

## Change

- New `lib/app/token/memory_token_provider.dart`:

  ```dart
  import '../../api/token_provider.dart';

  final class MemoryTokenProvider implements TokenProviderType {
    String? _token;

    @override
    Future<String?> token() async => _token;

    @override
    Future<void> save(String token) async => _token = token;

    @override
    Future<void> clear() async => _token = null;
  }
  ```

- New `lib/app/token/secure_storage_token_provider.dart`:

  ```dart
  import 'package:flutter_secure_storage/flutter_secure_storage.dart';

  import '../../api/token_provider.dart';

  final class SecureStorageTokenProvider implements TokenProviderType {
    const SecureStorageTokenProvider({FlutterSecureStorage storage = const FlutterSecureStorage()})
      : _storage = storage;

    static const String storageKey = 'kanthord.daemon_token';

    final FlutterSecureStorage _storage;

    @override
    Future<String?> token() => _storage.read(key: storageKey);

    @override
    Future<void> save(String token) => _storage.write(key: storageKey, value: token);

    @override
    Future<void> clear() => _storage.delete(key: storageKey);
  }
  ```

## Constraints

- Neither file imports `shared_preferences`. Neither file writes `window.localStorage`.
- Neither file reads `kIsWeb`. The platform choice happens one time, at the registration site in
  Story 03.
- `lib/api/` gains no implementation. The SDK reads no storage.
- No comment in either file.

## Tasks

### Task 001.1 — the token store tests

**Input:** `test/app/token/memory_token_provider_test.dart`,
`test/app/token/secure_storage_token_provider_test.dart`

**Action — RED:** write the two files verbatim.

`test/app/token/memory_token_provider_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/app/token/memory_token_provider.dart';

void main() {
  group('MemoryTokenProvider', () {
    group('token', () {
      test('should return null when no token is saved', () async {
        // Arrange
        final provider = MemoryTokenProvider();

        // Act
        final result = await provider.token();

        // Assert
        expect(result, isNull);
      });
    });

    group('save', () {
      test('should return the saved token when save was called', () async {
        // Arrange
        final provider = MemoryTokenProvider();

        // Act
        await provider.save('secret');

        // Assert
        expect(await provider.token(), 'secret');
      });
    });

    group('clear', () {
      test('should return null when clear was called', () async {
        // Arrange
        final provider = MemoryTokenProvider();
        await provider.save('secret');

        // Act
        await provider.clear();

        // Assert
        expect(await provider.token(), isNull);
      });
    });

    group('lifetime', () {
      test('should lose the token when the instance is discarded', () async {
        // Arrange
        final provider = MemoryTokenProvider();
        await provider.save('secret');

        // Act
        final replacement = MemoryTokenProvider();

        // Assert
        expect(await replacement.token(), isNull);
      });
    });
  });
}
```

`test/app/token/secure_storage_token_provider_test.dart`. `FlutterSecureStorage.setMockInitialValues`
swaps `FlutterSecureStoragePlatform.instance` for an in-memory implementation, so the file needs no
method-channel handler and no device:

```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/app/token/secure_storage_token_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues(<String, String>{});
  });

  group('SecureStorageTokenProvider', () {
    group('token', () {
      test('should return null when no token is saved', () async {
        // Arrange
        const provider = SecureStorageTokenProvider();

        // Act
        final result = await provider.token();

        // Assert
        expect(result, isNull);
      });
    });

    group('save', () {
      test('should return the saved token when save was called', () async {
        // Arrange
        const provider = SecureStorageTokenProvider();

        // Act
        await provider.save('secret');

        // Assert
        expect(await provider.token(), 'secret');
      });

      test('should write under the namespaced key when save was called', () async {
        // Arrange
        const provider = SecureStorageTokenProvider();

        // Act
        await provider.save('secret');

        // Assert
        expect(SecureStorageTokenProvider.storageKey, 'kanthord.daemon_token');
        expect(
          await const FlutterSecureStorage().read(key: SecureStorageTokenProvider.storageKey),
          'secret',
        );
      });
    });

    group('clear', () {
      test('should return null when clear was called', () async {
        // Arrange
        const provider = SecureStorageTokenProvider();
        await provider.save('secret');

        // Act
        await provider.clear();

        // Assert
        expect(await provider.token(), isNull);
      });
    });

    group('lifetime', () {
      test('should keep the token when a second instance reads it', () async {
        // Arrange
        const provider = SecureStorageTokenProvider();
        await provider.save('secret');

        // Act
        const replacement = SecureStorageTokenProvider();

        // Assert
        expect(await replacement.token(), 'secret');
      });
    });
  });
}
```

**Action — GREEN:** the software-engineer's Task 001.2 creates the seam.

### Task 001.2 — the two implementations

**Input:** `lib/app/token/memory_token_provider.dart`,
`lib/app/token/secure_storage_token_provider.dart`

**Action — GREEN:** write the two files exactly as the `## Change` section states.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/app/token` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- `NEEDS-HUMAN:` whether the keychain and the Android keystore accept the write on a real device.
  `FlutterSecureStorage.setMockInitialValues` replaces the platform, so the headless suite proves the
  contract and proves no platform behavior.
- Proof: `PASS 002-G2-TOKEN-STORE`.
