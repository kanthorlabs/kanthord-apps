# Story 06 — the selected-daemon provider

Epic: `.agent/plan/epics/002-app-composition.md`
Depends on: Story `04` (`DaemonCredentialStoreType`), Story `05` (`DaemonRegistryType`). EPIC 001.1
Story 02 fixed both provider contracts, so `BaseUrlProviderType` carries `endpoint()` and
`TokenProviderType` carries `tokenOf(String)`.

## Change

- New `lib/app/settings/selected_daemon_provider.dart`:

  ```dart
  import '../../api/base_url_provider.dart';
  import '../../api/daemon_endpoint.dart';
  import '../../api/token_provider.dart';
  import '../token/daemon_credential_store.dart';
  import 'daemon_registry.dart';

  final class SelectedDaemonProvider
      implements BaseUrlProviderType, TokenProviderType {
    const SelectedDaemonProvider(this._registry, this._credentials);

    final DaemonRegistryType _registry;
    final DaemonCredentialStoreType _credentials;

    @override
    Future<DaemonEndpoint?> endpoint() async {
      final daemon = await _registry.selected();
      if (daemon == null) return null;
      return DaemonEndpoint(id: daemon.id, name: daemon.name, baseUrl: daemon.baseUrl);
    }

    @override
    Future<String> baseUrl() async => (await _registry.selected())?.baseUrl ?? '';

    @override
    Future<String?> token() async {
      final daemon = await _registry.selected();
      if (daemon == null) return null;
      return _credentials.read(daemon.id);
    }

    @override
    Future<String?> tokenOf(String daemonId) => _credentials.read(daemonId);

    @override
    Future<void> save(String token) async {
      final daemon = await _registry.selected();
      if (daemon == null) return;
      await _credentials.save(daemon.id, token);
    }

    @override
    Future<void> clear() async {
      final daemon = await _registry.selected();
      if (daemon == null) return;
      await _credentials.delete(daemon.id);
    }
  }
  ```

## Constraints

- One class implements both interfaces. `get_it` registers one instance under both, which Story `07`
  proves with `identical`.
- **Every member resolves the daemon through `_registry.selected()`, never through
  `selectedId()`.** A stored selected id that matches no entry therefore behaves exactly like no
  selection, which is the G4 rule.
- **`baseUrl()` answers `''` when no daemon is selected.** The EPIC 001 contract makes the return
  non-nullable, and `BaseUrlInterceptor` never calls it — EPIC 001.1 Story 04 has it call
  `_config.endpoint()` exactly once per request and reject a `null` with
  `ApiNotConfiguredException`. `''` matches `_UnselectedBaseUrlProvider` in EPIC 001.1 Story 04. It
  throws no `StateError` and it invents no default.
- **`tokenOf(id)` reads the credential store directly and consults the registry not at all.** The
  pinning pair of EPIC 001.1 depends on it: the id comes from `options.extra[kDaemonIdKey]`, which
  `BaseUrlInterceptor` already pinned, so a selection change between the two interceptors cannot
  swap the token.
- `tokenOf` answers `null` for an id that holds no credential, an id that matches no daemon
  included. It never falls back to the selected daemon.
- **`save(token)` and `clear()` act on the selected daemon, and both are a no-op when nothing is
  selected.** Neither throws. They exist because `TokenProviderType` declares them; EPIC 003 and
  EPIC 003.1 write a credential through `DaemonCredentialStoreType` with an explicit id.
- The provider writes no `Daemon`, generates no id and calls no daemon.
- `lib/api/` gains nothing.
- No comment in the file.

## Tasks

### Task 006.1 — the provider test

**Input:** `test/app/settings/selected_daemon_provider_test.dart`

**Action — RED:** write the file verbatim.

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/base_url_provider.dart';
import 'package:kanthord/api/daemon_endpoint.dart';
import 'package:kanthord/api/token_provider.dart';
import 'package:kanthord/app/settings/daemon_registry.dart';
import 'package:kanthord/app/settings/selected_daemon_provider.dart';
import 'package:kanthord/app/token/memory_daemon_credential_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

late SharedPreferences _preferences;
late MemoryDaemonCredentialStore _credentials;
late PreferencesDaemonRegistry _registry;
late SelectedDaemonProvider _provider;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    _preferences = await SharedPreferences.getInstance();
    _credentials = MemoryDaemonCredentialStore();
    _registry = PreferencesDaemonRegistry(_preferences, _credentials);
    _provider = SelectedDaemonProvider(_registry, _credentials);
  });

  group('SelectedDaemonProvider', () {
    group('contract', () {
      test('should implement both provider interfaces when it is constructed', () {
        // Arrange
        final provider = _provider;

        // Act
        final isBaseUrl = provider is BaseUrlProviderType;
        final isToken = provider is TokenProviderType;

        // Assert
        expect(isBaseUrl, isTrue);
        expect(isToken, isTrue);
      });
    });

    group('endpoint', () {
      test('should return null when no daemon is selected', () async {
        // Arrange
        await _registry.add(name: 'local', baseUrl: 'http://localhost:31415');

        // Act
        final endpoint = await _provider.endpoint();

        // Assert
        expect(endpoint, isNull);
      });

      test('should map the selected daemon when one is selected', () async {
        // Arrange
        final added = await _registry.add(name: 'local', baseUrl: 'http://localhost:31415');
        await _registry.select(added.id);

        // Act
        final endpoint = await _provider.endpoint();

        // Assert
        expect(
          endpoint,
          const DaemonEndpoint(id: 'd1', name: 'local', baseUrl: 'http://localhost:31415'),
        );
      });

      test('should return null when the stored selected id matches no entry', () async {
        // Arrange
        await _registry.add(name: 'local', baseUrl: 'http://localhost:31415');
        await _registry.select('absent');

        // Act
        final endpoint = await _provider.endpoint();

        // Assert
        expect(endpoint, isNull);
      });

      test('should follow the selection when it moves to the second daemon', () async {
        // Arrange
        final first = await _registry.add(name: 'first', baseUrl: 'http://127.0.0.1:31415');
        final second = await _registry.add(name: 'second', baseUrl: 'http://10.0.0.2:31415');
        await _registry.select(first.id);

        // Act
        await _registry.select(second.id);
        final endpoint = await _provider.endpoint();

        // Assert
        expect(endpoint!.id, 'd2');
        expect(endpoint.baseUrl, 'http://10.0.0.2:31415');
      });
    });

    group('baseUrl', () {
      test('should return an empty string when no daemon is selected', () async {
        // Arrange
        await _registry.add(name: 'local', baseUrl: 'http://localhost:31415');

        // Act
        final baseUrl = await _provider.baseUrl();

        // Assert
        expect(baseUrl, '');
      });

      test('should throw no exception when no daemon is selected', () async {
        // Arrange
        final provider = _provider;

        // Act
        Future<void> act() => provider.baseUrl();

        // Assert
        await expectLater(act(), completes);
      });

      test('should return the base URL of the selected daemon when one is selected', () async {
        // Arrange
        final added = await _registry.add(name: 'local', baseUrl: 'http://localhost:31415');
        await _registry.select(added.id);

        // Act
        final baseUrl = await _provider.baseUrl();

        // Assert
        expect(baseUrl, 'http://localhost:31415');
      });
    });

    group('tokenOf', () {
      test('should return the credential of the asked id when it holds one', () async {
        // Arrange
        await _credentials.save('d1', 'token-one');
        await _credentials.save('d2', 'token-two');

        // Act
        final token = await _provider.tokenOf('d2');

        // Assert
        expect(token, 'token-two');
      });

      test('should return null when the asked id holds no credential', () async {
        // Arrange
        await _credentials.save('d1', 'token-one');

        // Act
        final token = await _provider.tokenOf('d2');

        // Assert
        expect(token, isNull);
      });

      test('should ignore the selection when an id is asked', () async {
        // Arrange
        final added = await _registry.add(name: 'local', baseUrl: 'http://localhost:31415');
        await _registry.select(added.id);
        await _credentials.save(added.id, 'token-selected');

        // Act
        final token = await _provider.tokenOf('other');

        // Assert
        expect(token, isNull);
      });
    });

    group('token', () {
      test('should return null when no daemon is selected', () async {
        // Arrange
        await _credentials.save('d1', 'token-one');

        // Act
        final token = await _provider.token();

        // Assert
        expect(token, isNull);
      });

      test('should return the credential of the selected daemon when one is selected', () async {
        // Arrange
        final added = await _registry.add(name: 'local', baseUrl: 'http://localhost:31415');
        await _registry.select(added.id);
        await _credentials.save(added.id, 'token-one');

        // Act
        final token = await _provider.token();

        // Assert
        expect(token, 'token-one');
      });

      test('should return null when the selected daemon holds no credential', () async {
        // Arrange
        final added = await _registry.add(name: 'local', baseUrl: 'http://localhost:31415');
        await _registry.select(added.id);

        // Act
        final token = await _provider.token();

        // Assert
        expect(token, isNull);
      });
    });

    group('save', () {
      test('should write the credential of the selected daemon when one is selected', () async {
        // Arrange
        final added = await _registry.add(name: 'local', baseUrl: 'http://localhost:31415');
        await _registry.select(added.id);

        // Act
        await _provider.save('token-one');
        final token = await _credentials.read(added.id);

        // Assert
        expect(token, 'token-one');
      });

      test('should write no credential when no daemon is selected', () async {
        // Arrange
        final added = await _registry.add(name: 'local', baseUrl: 'http://localhost:31415');

        // Act
        await _provider.save('token-one');
        final token = await _credentials.read(added.id);

        // Assert
        expect(token, isNull);
      });

      test('should throw no exception when no daemon is selected', () async {
        // Arrange
        final provider = _provider;

        // Act
        Future<void> act() => provider.save('token-one');

        // Assert
        await expectLater(act(), completes);
      });
    });

    group('clear', () {
      test('should delete the credential of the selected daemon when one is selected', () async {
        // Arrange
        final added = await _registry.add(name: 'local', baseUrl: 'http://localhost:31415');
        await _registry.select(added.id);
        await _credentials.save(added.id, 'token-one');

        // Act
        await _provider.clear();
        final token = await _credentials.read(added.id);

        // Assert
        expect(token, isNull);
      });

      test('should keep the credential of another daemon when the selected one is cleared', () async {
        // Arrange
        final first = await _registry.add(name: 'first', baseUrl: 'http://127.0.0.1:31415');
        final second = await _registry.add(name: 'second', baseUrl: 'http://10.0.0.2:31415');
        await _registry.select(first.id);
        await _credentials.save(first.id, 'token-one');
        await _credentials.save(second.id, 'token-two');

        // Act
        await _provider.clear();
        final kept = await _credentials.read(second.id);

        // Assert
        expect(kept, 'token-two');
      });

      test('should throw no exception when no daemon is selected', () async {
        // Arrange
        final provider = _provider;

        // Act
        Future<void> act() => provider.clear();

        // Assert
        await expectLater(act(), completes);
      });
    });

    group('the pinning pair', () {
      test('should serve the token of the pinned id when the selection moved after the '
          'endpoint resolved', () async {
        // Arrange
        final first = await _registry.add(name: 'first', baseUrl: 'http://127.0.0.1:31415');
        final second = await _registry.add(name: 'second', baseUrl: 'http://10.0.0.2:31415');
        await _credentials.save(first.id, 'token-one');
        await _credentials.save(second.id, 'token-two');
        await _registry.select(first.id);
        final pinned = await _provider.endpoint();

        // Act
        await _registry.select(second.id);
        final token = await _provider.tokenOf(pinned!.id);

        // Assert
        expect(pinned.id, 'd1');
        expect(token, 'token-one');
        expect(await _provider.token(), 'token-two');
      });
    });

    group('the daemon it maps', () {
      test('should carry the edited name when the daemon was renamed', () async {
        // Arrange
        final added = await _registry.add(name: 'local', baseUrl: 'http://localhost:31415');
        await _registry.select(added.id);
        await _registry.update(added.copyWith(name: 'renamed'));

        // Act
        final endpoint = await _provider.endpoint();

        // Assert
        expect(endpoint!.name, 'renamed');
        expect(endpoint.id, 'd1');
      });

      test('should ignore the confirmed instant when the daemon is mapped', () async {
        // Arrange
        final added = await _registry.add(name: 'local', baseUrl: 'http://localhost:31415');
        await _registry.select(added.id);
        await _registry.update(added.copyWith(confirmedAt: DateTime.utc(2026, 1, 1, 12)));

        // Act
        final endpoint = await _provider.endpoint();

        // Assert
        expect(
          endpoint,
          const DaemonEndpoint(id: 'd1', name: 'local', baseUrl: 'http://localhost:31415'),
        );
      });
    });
  });
}
```

The file imports no `daemon.dart`: it never names the `Daemon` type, and `copyWith` is called on the
value `add` returns. An unused import fails `make analyze`.

**Action — GREEN:** the software-engineer's Task 006.2 creates the seam.

### Task 006.2 — the provider

**Input:** `lib/app/settings/selected_daemon_provider.dart`

**Action — GREEN:** write the file exactly as the `## Change` section states.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/app/settings/selected_daemon_provider_test.dart` exits 0.
- `make test-one T=test/app/settings` exits 0 — the whole directory.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: this Story delivers no `PASS` line of its own. `PASS 002-G3-REGISTRY` runs
  `make test-one T=test/app/settings`, which includes this file, and `PASS 002-G1-DI` proves the
  one-instance-two-interfaces registration in Story `07`.
