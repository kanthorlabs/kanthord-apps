# Story 04 — the credential store

Epic: `.agent/plan/epics/002-app-composition.md`
Depends on: none. It takes a daemon id as a `String` and imports no `Daemon`.

## Change

- New `lib/app/token/daemon_credential_store.dart`:

  ```dart
  const String kDaemonTokenKeyPrefix = 'kanthord.daemon_token.';

  abstract class DaemonCredentialStoreType {
    Future<String?> read(String daemonId);
    Future<void> save(String daemonId, String token);
    Future<void> delete(String daemonId);
  }

  String daemonTokenKey(String daemonId) => '$kDaemonTokenKeyPrefix$daemonId';
  ```

- New `lib/app/token/memory_daemon_credential_store.dart`:

  ```dart
  import 'daemon_credential_store.dart';

  final class MemoryDaemonCredentialStore implements DaemonCredentialStoreType {
    final Map<String, String> _tokens = <String, String>{};

    @override
    Future<String?> read(String daemonId) async => _tokens[daemonId];

    @override
    Future<void> save(String daemonId, String token) async {
      _tokens[daemonId] = token;
    }

    @override
    Future<void> delete(String daemonId) async {
      _tokens.remove(daemonId);
    }
  }
  ```

- New `lib/app/token/secure_storage_daemon_credential_store.dart`:

  ```dart
  import 'package:flutter_secure_storage/flutter_secure_storage.dart';

  import 'daemon_credential_store.dart';

  final class SecureStorageDaemonCredentialStore implements DaemonCredentialStoreType {
    const SecureStorageDaemonCredentialStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

    final FlutterSecureStorage _storage;

    @override
    Future<String?> read(String daemonId) => _storage.read(key: daemonTokenKey(daemonId));

    @override
    Future<void> save(String daemonId, String token) =>
        _storage.write(key: daemonTokenKey(daemonId), value: token);

    @override
    Future<void> delete(String daemonId) => _storage.delete(key: daemonTokenKey(daemonId));
  }
  ```

## Constraints

- The key is `kanthord.daemon_token.<id>`, built by `daemonTokenKey` and by nothing else. Two ids
  therefore never share a key.
- `read` answers `null` for an unknown id. It throws nothing.
- `delete` on an absent id is a no-op. It throws nothing.
- `MemoryDaemonCredentialStore` holds its map in the instance, so a discarded instance loses every
  token. That is the web posture: **a token never reaches `shared_preferences` and never reaches
  `localStorage`.**
- `SecureStorageDaemonCredentialStore` takes an optional `FlutterSecureStorage` so a test may inject
  one. It stays a `const`-constructible `final class`.
- `FlutterSecureStorage.read`, `.write` and `.delete` take `key` as a **named required**
  parameter at `flutter_secure_storage` 10.3.1. Never positional.
- Neither implementation reads `shared_preferences`, and neither knows what a `Daemon` is.
- `lib/api/` gains nothing. The dependency runs one way.
- No comment in any of the three files.

## Tasks

### Task 004.1 — the memory store test

**Input:** `test/app/token/memory_daemon_credential_store_test.dart`

**Action — RED:** write the file verbatim.

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/app/token/daemon_credential_store.dart';
import 'package:kanthord/app/token/memory_daemon_credential_store.dart';

void main() {
  group('MemoryDaemonCredentialStore', () {
    group('read', () {
      test('should return null when no token is saved for the id', () async {
        // Arrange
        final store = MemoryDaemonCredentialStore();

        // Act
        final token = await store.read('d1');

        // Assert
        expect(token, isNull);
      });

      test('should return the token of the asked id when two ids hold a token', () async {
        // Arrange
        final store = MemoryDaemonCredentialStore();
        await store.save('d1', 'token-one');
        await store.save('d2', 'token-two');

        // Act
        final first = await store.read('d1');
        final second = await store.read('d2');

        // Assert
        expect(first, 'token-one');
        expect(second, 'token-two');
      });

      test('should return null for another id when one id holds a token', () async {
        // Arrange
        final store = MemoryDaemonCredentialStore();
        await store.save('d1', 'token-one');

        // Act
        final other = await store.read('d2');

        // Assert
        expect(other, isNull);
      });

      test('should return null when the instance is discarded', () async {
        // Arrange
        final first = MemoryDaemonCredentialStore();
        await first.save('d1', 'token-one');

        // Act
        final second = MemoryDaemonCredentialStore();
        final token = await second.read('d1');

        // Assert
        expect(token, isNull);
      });
    });

    group('save', () {
      test('should replace the token when the same id is saved twice', () async {
        // Arrange
        final store = MemoryDaemonCredentialStore();
        await store.save('d1', 'token-one');

        // Act
        await store.save('d1', 'token-two');
        final token = await store.read('d1');

        // Assert
        expect(token, 'token-two');
      });
    });

    group('delete', () {
      test('should return null when the token of the id is deleted', () async {
        // Arrange
        final store = MemoryDaemonCredentialStore();
        await store.save('d1', 'token-one');

        // Act
        await store.delete('d1');
        final token = await store.read('d1');

        // Assert
        expect(token, isNull);
      });

      test('should keep the token of another id when one id is deleted', () async {
        // Arrange
        final store = MemoryDaemonCredentialStore();
        await store.save('d1', 'token-one');
        await store.save('d2', 'token-two');

        // Act
        await store.delete('d1');
        final kept = await store.read('d2');

        // Assert
        expect(kept, 'token-two');
      });

      test('should throw no exception when the id holds no token', () async {
        // Arrange
        final store = MemoryDaemonCredentialStore();

        // Act
        Future<void> act() => store.delete('d1');

        // Assert
        await expectLater(act(), completes);
      });
    });
  });

  group('daemonTokenKey', () {
    test('should prefix the id when the key is built', () {
      // Arrange
      const id = 'd1';

      // Act
      final key = daemonTokenKey(id);

      // Assert
      expect(key, 'kanthord.daemon_token.d1');
    });
  });
}
```

**Action — GREEN:** the software-engineer's Task 004.3 creates the seam.

### Task 004.2 — the secure storage store test

**Input:** `test/app/token/secure_storage_daemon_credential_store_test.dart`

**Action — RED:** write the file verbatim. `FlutterSecureStorage.setMockInitialValues` replaces
`FlutterSecureStoragePlatform.instance` with the in-memory double the package ships, so no
method-channel handler is needed.

```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/app/token/secure_storage_daemon_credential_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues(<String, String>{});
  });

  group('SecureStorageDaemonCredentialStore', () {
    group('read', () {
      test('should return null when no token is saved for the id', () async {
        // Arrange
        const store = SecureStorageDaemonCredentialStore();

        // Act
        final token = await store.read('d1');

        // Assert
        expect(token, isNull);
      });

      test('should return the saved token when the id was saved', () async {
        // Arrange
        const store = SecureStorageDaemonCredentialStore();
        await store.save('d1', 'token-one');

        // Act
        final token = await store.read('d1');

        // Assert
        expect(token, 'token-one');
      });

      test('should return null for another id when one id holds a token', () async {
        // Arrange
        const store = SecureStorageDaemonCredentialStore();
        await store.save('d1', 'token-one');

        // Act
        final other = await store.read('d2');

        // Assert
        expect(other, isNull);
      });
    });

    group('save', () {
      test('should write under the prefixed key when the token is saved', () async {
        // Arrange
        const store = SecureStorageDaemonCredentialStore();
        const storage = FlutterSecureStorage();

        // Act
        await store.save('d1', 'token-one');
        final raw = await storage.read(key: 'kanthord.daemon_token.d1');

        // Assert
        expect(raw, 'token-one');
      });

      test('should replace the token when the same id is saved twice', () async {
        // Arrange
        const store = SecureStorageDaemonCredentialStore();
        await store.save('d1', 'token-one');

        // Act
        await store.save('d1', 'token-two');
        final token = await store.read('d1');

        // Assert
        expect(token, 'token-two');
      });
    });

    group('delete', () {
      test('should return null when the token of the id is deleted', () async {
        // Arrange
        const store = SecureStorageDaemonCredentialStore();
        await store.save('d1', 'token-one');

        // Act
        await store.delete('d1');
        final token = await store.read('d1');

        // Assert
        expect(token, isNull);
      });

      test('should keep the token of another id when one id is deleted', () async {
        // Arrange
        const store = SecureStorageDaemonCredentialStore();
        await store.save('d1', 'token-one');
        await store.save('d2', 'token-two');

        // Act
        await store.delete('d1');
        final kept = await store.read('d2');

        // Assert
        expect(kept, 'token-two');
      });

      test('should throw no exception when the id holds no token', () async {
        // Arrange
        const store = SecureStorageDaemonCredentialStore();

        // Act
        Future<void> act() => store.delete('d1');

        // Assert
        await expectLater(act(), completes);
      });
    });
  });
}
```

**Action — GREEN:** the software-engineer's Task 004.3 creates the seam.

### Task 004.3 — the contract and the two implementations

**Input:** `lib/app/token/daemon_credential_store.dart`,
`lib/app/token/memory_daemon_credential_store.dart`,
`lib/app/token/secure_storage_daemon_credential_store.dart`

**Action — GREEN:** write the three files exactly as the `## Change` section states.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/app/token` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- `NEEDS-HUMAN:` that the Keychain, the Keystore and `libsecret` accept the key on a real device or
  desktop host. `FlutterSecureStorage.setMockInitialValues` proves the store's own logic and nothing
  about the platform backend. `make dev` is web, which uses the memory store instead, so the browser
  loop cannot prove this either.
- Proof: `PASS 002-G2-CREDENTIALS`.
