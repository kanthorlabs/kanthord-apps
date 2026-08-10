# Story 05 — the daemon registry

Epic: `.agent/plan/epics/002-app-composition.md`
Depends on: Story `02` (`Env.apiEndpoint`), Story `03` (`Daemon`), Story `04`
(`DaemonCredentialStoreType`).

## Change

- New `lib/app/settings/daemon_registry.dart`:

  ```dart
  import 'dart:convert';

  import 'package:shared_preferences/shared_preferences.dart';

  import '../env/env.dart';
  import '../token/daemon_credential_store.dart';
  import 'daemon.dart';

  const String kDaemonListKey = 'kanthord.daemons';
  const String kSelectedDaemonIdKey = 'kanthord.selected_daemon_id';
  const String kSeedDaemonName = 'local';

  final RegExp _kGeneratedId = RegExp(r'^d(\d+)$');

  abstract class DaemonRegistryType {
    Future<List<Daemon>> list();
    Future<Daemon> add({required String name, required String baseUrl});
    Future<void> update(Daemon daemon);
    Future<void> remove(String id);
    Future<void> select(String id);
    Future<String?> selectedId();
    Future<Daemon?> selected();
    Future<void> seedDefault();
  }

  final class PreferencesDaemonRegistry implements DaemonRegistryType {
    const PreferencesDaemonRegistry(this._preferences, this._credentials);

    final SharedPreferences _preferences;
    final DaemonCredentialStoreType _credentials;

    @override
    Future<List<Daemon>> list() async {
      final raw = _preferences.getString(kDaemonListKey);
      if (raw == null) return const <Daemon>[];
      final decoded = jsonDecode(raw) as List<dynamic>;
      return decoded
          .map((entry) => Daemon.fromJson(entry as Map<String, dynamic>))
          .toList(growable: false);
    }

    @override
    Future<Daemon> add({required String name, required String baseUrl}) async {
      final daemons = await list();
      final daemon = Daemon(id: _nextId(daemons), name: name, baseUrl: baseUrl);
      await _write(<Daemon>[...daemons, daemon]);
      return daemon;
    }

    @override
    Future<void> update(Daemon daemon) async {
      final daemons = await list();
      final index = daemons.indexWhere((entry) => entry.id == daemon.id);
      if (index < 0) return;
      final next = <Daemon>[...daemons];
      next[index] = daemon;
      await _write(next);
    }

    @override
    Future<void> remove(String id) async {
      final daemons = await list();
      if (!daemons.any((entry) => entry.id == id)) return;
      await _credentials.delete(id);
      await _write(daemons.where((entry) => entry.id != id).toList(growable: false));
      if (_preferences.getString(kSelectedDaemonIdKey) == id) {
        await _preferences.remove(kSelectedDaemonIdKey);
      }
    }

    @override
    Future<void> select(String id) async {
      await _preferences.setString(kSelectedDaemonIdKey, id);
    }

    @override
    Future<String?> selectedId() async => _preferences.getString(kSelectedDaemonIdKey);

    @override
    Future<Daemon?> selected() async {
      final id = _preferences.getString(kSelectedDaemonIdKey);
      if (id == null) return null;
      for (final daemon in await list()) {
        if (daemon.id == id) return daemon;
      }
      return null;
    }

    @override
    Future<void> seedDefault() async {
      if ((await list()).isNotEmpty) return;
      final daemon = await add(name: kSeedDaemonName, baseUrl: Env.apiEndpoint);
      await select(daemon.id);
    }

    Future<void> _write(List<Daemon> daemons) async {
      final encoded = jsonEncode(
        daemons.map((daemon) => daemon.toJson()).toList(growable: false),
      );
      await _preferences.setString(kDaemonListKey, encoded);
    }

    String _nextId(List<Daemon> daemons) {
      var highest = 0;
      for (final daemon in daemons) {
        final match = _kGeneratedId.firstMatch(daemon.id);
        if (match == null) continue;
        final value = int.parse(match.group(1)!);
        if (value > highest) highest = value;
      }
      return 'd${highest + 1}';
    }
  }
  ```

## Constraints

- **Two `shared_preferences` keys and no third.** `kanthord.daemons` holds the JSON list;
  `kanthord.selected_daemon_id` holds the selected id. The id counter is derived from the list, never
  stored.
- **The id rule is `d<n>`, where `n` is one above the highest `d<digits>` suffix already in the list.**
  An empty registry therefore yields `d1`. The rule is a pure function of the stored list, so the same
  input always yields the same id, and it needs no `uuid` dependency. An id that does not match
  `^d(\d+)$` is ignored by the scan, so a hand-seeded id never breaks generation.
- `list()` returns insertion order — the order the JSON array holds. It sorts nothing.
- `list()` returns an empty list before any write. It never returns null and it never throws on a
  missing key.
- `add` appends. It never inserts at the head and it never reorders.
- `update` matches on `id` and replaces in place, so the position is kept. An `id` that matches no
  entry is a no-op, not an error. `update` never changes an `id`.
- `select(id)` writes the id even when it matches no entry. `selected()` is the one member that
  resolves it, and it answers `null` on a mismatch. That is G4.
- **`remove(id)` deletes the credential first, then writes the shorter list.** A throwing
  `delete` therefore leaves the entry in place, which is the G6 rule. When the removed id was the
  selected one, `remove` clears `kanthord.selected_daemon_id`.
- `remove` on an unknown id is a no-op. It calls the credential store not at all.
- **`seedDefault()` runs one time.** A non-empty registry returns before the `add`, so a later start
  adds nothing and re-selects nothing. It sets no `confirmedAt` and writes no token.
- `seedDefault()` is the one member that reads `Env.`, and `daemon_registry.dart` is the one file
  under `lib/app/settings/` that references it. Task 005.4 holds the grep.
- The registry calls no daemon. It never sets `confirmedAt`. EPIC 003 owns the probe.
- No list screen, no switcher, no add or remove control. EPIC 003.1 owns every one of them.
- No comment in the file.

## Tasks

### Task 005.1 — the list, add and update test

**Input:** `test/app/settings/daemon_registry_test.dart`

**Action — RED:** write the file verbatim.

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/app/settings/daemon.dart';
import 'package:kanthord/app/settings/daemon_registry.dart';
import 'package:kanthord/app/token/memory_daemon_credential_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

late SharedPreferences _preferences;
late MemoryDaemonCredentialStore _credentials;

PreferencesDaemonRegistry _registry() =>
    PreferencesDaemonRegistry(_preferences, _credentials);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    _preferences = await SharedPreferences.getInstance();
    _credentials = MemoryDaemonCredentialStore();
  });

  group('PreferencesDaemonRegistry', () {
    group('list', () {
      test('should return an empty list when nothing was written', () async {
        // Arrange
        final registry = _registry();

        // Act
        final daemons = await registry.list();

        // Assert
        expect(daemons, isEmpty);
      });

      test('should return the insertion order when three daemons are added', () async {
        // Arrange
        final registry = _registry();
        await registry.add(name: 'first', baseUrl: 'http://127.0.0.1:31415');
        await registry.add(name: 'second', baseUrl: 'http://10.0.0.2:31415');
        await registry.add(name: 'third', baseUrl: 'http://10.0.0.3:31415');

        // Act
        final names = (await registry.list()).map((daemon) => daemon.name).toList();

        // Assert
        expect(names, <String>['first', 'second', 'third']);
      });

      test('should return the insertion order when the registry is read again', () async {
        // Arrange
        final registry = _registry();
        await registry.add(name: 'first', baseUrl: 'http://127.0.0.1:31415');
        await registry.add(name: 'second', baseUrl: 'http://10.0.0.2:31415');

        // Act
        final reloaded = _registry();
        final names = (await reloaded.list()).map((daemon) => daemon.name).toList();

        // Assert
        expect(names, <String>['first', 'second']);
      });
    });

    group('add', () {
      test('should return the generated id when the registry is empty', () async {
        // Arrange
        final registry = _registry();

        // Act
        final daemon = await registry.add(name: 'local', baseUrl: 'http://localhost:31415');

        // Assert
        expect(daemon.id, 'd1');
        expect(daemon.name, 'local');
        expect(daemon.baseUrl, 'http://localhost:31415');
      });

      test('should confirm nothing when a daemon is added', () async {
        // Arrange
        final registry = _registry();

        // Act
        final daemon = await registry.add(name: 'local', baseUrl: 'http://localhost:31415');

        // Assert
        expect(daemon.confirmedAt, isNull);
      });

      test('should generate a distinct id when three daemons are added', () async {
        // Arrange
        final registry = _registry();

        // Act
        final first = await registry.add(name: 'a', baseUrl: 'http://127.0.0.1:31415');
        final second = await registry.add(name: 'b', baseUrl: 'http://10.0.0.2:31415');
        final third = await registry.add(name: 'c', baseUrl: 'http://10.0.0.3:31415');

        // Assert
        expect(<String>[first.id, second.id, third.id], <String>['d1', 'd2', 'd3']);
      });

      test('should generate the same ids when the same sequence is replayed', () async {
        // Arrange
        final first = _registry();
        await first.add(name: 'a', baseUrl: 'http://127.0.0.1:31415');
        await first.add(name: 'b', baseUrl: 'http://10.0.0.2:31415');
        final firstIds = (await first.list()).map((daemon) => daemon.id).toList();

        // Act
        SharedPreferences.setMockInitialValues(<String, Object>{});
        _preferences = await SharedPreferences.getInstance();
        final second = _registry();
        await second.add(name: 'a', baseUrl: 'http://127.0.0.1:31415');
        await second.add(name: 'b', baseUrl: 'http://10.0.0.2:31415');
        final secondIds = (await second.list()).map((daemon) => daemon.id).toList();

        // Assert
        expect(secondIds, firstIds);
      });
    });

    group('update', () {
      test('should keep the id when the name and the base URL are edited', () async {
        // Arrange
        final registry = _registry();
        final daemon = await registry.add(name: 'local', baseUrl: 'http://localhost:31415');

        // Act
        await registry.update(
          daemon.copyWith(name: 'renamed', baseUrl: 'http://10.0.0.9:31415'),
        );
        final stored = (await registry.list()).single;

        // Assert
        expect(stored.id, 'd1');
        expect(stored.name, 'renamed');
        expect(stored.baseUrl, 'http://10.0.0.9:31415');
      });

      test('should keep the position when the middle daemon is edited', () async {
        // Arrange
        final registry = _registry();
        await registry.add(name: 'first', baseUrl: 'http://127.0.0.1:31415');
        final middle = await registry.add(name: 'second', baseUrl: 'http://10.0.0.2:31415');
        await registry.add(name: 'third', baseUrl: 'http://10.0.0.3:31415');

        // Act
        await registry.update(middle.copyWith(name: 'renamed'));
        final names = (await registry.list()).map((daemon) => daemon.name).toList();

        // Assert
        expect(names, <String>['first', 'renamed', 'third']);
      });

      test('should keep the confirmed instant when it is written', () async {
        // Arrange
        final registry = _registry();
        final daemon = await registry.add(name: 'local', baseUrl: 'http://localhost:31415');

        // Act
        await registry.update(daemon.copyWith(confirmedAt: DateTime.utc(2026, 1, 1, 12)));
        final stored = (await registry.list()).single;

        // Assert
        expect(stored.confirmedAt, DateTime.utc(2026, 1, 1, 12));
      });

      test('should change nothing when the id matches no entry', () async {
        // Arrange
        final registry = _registry();
        await registry.add(name: 'local', baseUrl: 'http://localhost:31415');

        // Act
        await registry.update(
          const Daemon(id: 'absent', name: 'ghost', baseUrl: 'http://10.0.0.9:31415'),
        );
        final daemons = await registry.list();

        // Assert
        expect(daemons.length, 1);
        expect(daemons.single.name, 'local');
      });
    });
  });
}
```

**Action — GREEN:** the software-engineer's Task 005.5 creates the seam.

### Task 005.2 — the selection test

**Input:** `test/app/settings/daemon_registry_selection_test.dart`

**Action — RED:** write the file verbatim.

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/app/settings/daemon_registry.dart';
import 'package:kanthord/app/token/memory_daemon_credential_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

late SharedPreferences _preferences;
late MemoryDaemonCredentialStore _credentials;

PreferencesDaemonRegistry _registry() =>
    PreferencesDaemonRegistry(_preferences, _credentials);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    _preferences = await SharedPreferences.getInstance();
    _credentials = MemoryDaemonCredentialStore();
  });

  group('PreferencesDaemonRegistry', () {
    group('selected', () {
      test('should return null when the registry is empty', () async {
        // Arrange
        final registry = _registry();

        // Act
        final daemon = await registry.selected();

        // Assert
        expect(daemon, isNull);
      });

      test('should return null when a daemon exists and none is selected', () async {
        // Arrange
        final registry = _registry();
        await registry.add(name: 'local', baseUrl: 'http://localhost:31415');

        // Act
        final daemon = await registry.selected();

        // Assert
        expect(daemon, isNull);
      });

      test('should return the selected daemon when the id matches an entry', () async {
        // Arrange
        final registry = _registry();
        final added = await registry.add(name: 'local', baseUrl: 'http://localhost:31415');
        await registry.select(added.id);

        // Act
        final daemon = await registry.selected();

        // Assert
        expect(daemon, added);
      });

      test('should return null when the stored selected id matches no entry', () async {
        // Arrange
        final registry = _registry();
        await registry.add(name: 'local', baseUrl: 'http://localhost:31415');
        await registry.select('absent');

        // Act
        final daemon = await registry.selected();

        // Assert
        expect(daemon, isNull);
      });

      test('should throw no exception when the stored selected id matches no entry', () async {
        // Arrange
        final registry = _registry();
        await registry.select('absent');

        // Act
        Future<void> act() => registry.selected();

        // Assert
        await expectLater(act(), completes);
      });

      test('should return the second daemon when the selection moves', () async {
        // Arrange
        final registry = _registry();
        final first = await registry.add(name: 'first', baseUrl: 'http://127.0.0.1:31415');
        final second = await registry.add(name: 'second', baseUrl: 'http://10.0.0.2:31415');
        await registry.select(first.id);

        // Act
        await registry.select(second.id);
        final daemon = await registry.selected();

        // Assert
        expect(daemon, second);
      });
    });

    group('selectedId', () {
      test('should return null when nothing was selected', () async {
        // Arrange
        final registry = _registry();

        // Act
        final id = await registry.selectedId();

        // Assert
        expect(id, isNull);
      });

      test('should return the written id when the id matches no entry', () async {
        // Arrange
        final registry = _registry();

        // Act
        await registry.select('absent');
        final id = await registry.selectedId();

        // Assert
        expect(id, 'absent');
      });

      test('should return the selected id when the registry is read again', () async {
        // Arrange
        final registry = _registry();
        final added = await registry.add(name: 'local', baseUrl: 'http://localhost:31415');
        await registry.select(added.id);

        // Act
        final reloaded = _registry();
        final id = await reloaded.selectedId();

        // Assert
        expect(id, 'd1');
      });
    });
  });
}
```

**Action — GREEN:** the software-engineer's Task 005.5 creates the seam.

### Task 005.3 — the removal test

**Input:** `test/app/settings/daemon_registry_remove_test.dart`

**Action — RED:** write the file verbatim.

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/app/settings/daemon_registry.dart';
import 'package:kanthord/app/token/daemon_credential_store.dart';
import 'package:kanthord/app/token/memory_daemon_credential_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

final class _FailingCredentialStore implements DaemonCredentialStoreType {
  final List<String> deleted = <String>[];

  @override
  Future<String?> read(String daemonId) async => null;

  @override
  Future<void> save(String daemonId, String token) async {}

  @override
  Future<void> delete(String daemonId) async {
    deleted.add(daemonId);
    throw StateError('the keychain refused the delete');
  }
}

late SharedPreferences _preferences;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    _preferences = await SharedPreferences.getInstance();
  });

  group('PreferencesDaemonRegistry', () {
    group('remove', () {
      test('should drop the entry when the daemon is removed', () async {
        // Arrange
        final credentials = MemoryDaemonCredentialStore();
        final registry = PreferencesDaemonRegistry(_preferences, credentials);
        final added = await registry.add(name: 'local', baseUrl: 'http://localhost:31415');

        // Act
        await registry.remove(added.id);
        final daemons = await registry.list();

        // Assert
        expect(daemons, isEmpty);
      });

      test('should leave no orphan token when the daemon is removed', () async {
        // Arrange
        final credentials = MemoryDaemonCredentialStore();
        final registry = PreferencesDaemonRegistry(_preferences, credentials);
        final added = await registry.add(name: 'local', baseUrl: 'http://localhost:31415');
        await credentials.save(added.id, 'token-one');

        // Act
        await registry.remove(added.id);
        final token = await credentials.read(added.id);

        // Assert
        expect(token, isNull);
      });

      test('should keep the token of another daemon when one daemon is removed', () async {
        // Arrange
        final credentials = MemoryDaemonCredentialStore();
        final registry = PreferencesDaemonRegistry(_preferences, credentials);
        final first = await registry.add(name: 'first', baseUrl: 'http://127.0.0.1:31415');
        final second = await registry.add(name: 'second', baseUrl: 'http://10.0.0.2:31415');
        await credentials.save(first.id, 'token-one');
        await credentials.save(second.id, 'token-two');

        // Act
        await registry.remove(first.id);
        final kept = await credentials.read(second.id);

        // Assert
        expect(kept, 'token-two');
      });

      test('should keep the remaining order when the middle daemon is removed', () async {
        // Arrange
        final credentials = MemoryDaemonCredentialStore();
        final registry = PreferencesDaemonRegistry(_preferences, credentials);
        await registry.add(name: 'first', baseUrl: 'http://127.0.0.1:31415');
        final middle = await registry.add(name: 'second', baseUrl: 'http://10.0.0.2:31415');
        await registry.add(name: 'third', baseUrl: 'http://10.0.0.3:31415');

        // Act
        await registry.remove(middle.id);
        final names = (await registry.list()).map((daemon) => daemon.name).toList();

        // Assert
        expect(names, <String>['first', 'third']);
      });

      test('should clear the selection when the selected daemon is removed', () async {
        // Arrange
        final credentials = MemoryDaemonCredentialStore();
        final registry = PreferencesDaemonRegistry(_preferences, credentials);
        final added = await registry.add(name: 'local', baseUrl: 'http://localhost:31415');
        await registry.select(added.id);

        // Act
        await registry.remove(added.id);
        final selectedId = await registry.selectedId();
        final selected = await registry.selected();

        // Assert
        expect(selectedId, isNull);
        expect(selected, isNull);
      });

      test('should keep the selection when another daemon is removed', () async {
        // Arrange
        final credentials = MemoryDaemonCredentialStore();
        final registry = PreferencesDaemonRegistry(_preferences, credentials);
        final first = await registry.add(name: 'first', baseUrl: 'http://127.0.0.1:31415');
        final second = await registry.add(name: 'second', baseUrl: 'http://10.0.0.2:31415');
        await registry.select(second.id);

        // Act
        await registry.remove(first.id);
        final selected = await registry.selected();

        // Assert
        expect(selected, second);
      });

      test('should change nothing when the id matches no entry', () async {
        // Arrange
        final credentials = MemoryDaemonCredentialStore();
        final registry = PreferencesDaemonRegistry(_preferences, credentials);
        await registry.add(name: 'local', baseUrl: 'http://localhost:31415');

        // Act
        await registry.remove('absent');
        final daemons = await registry.list();

        // Assert
        expect(daemons.length, 1);
      });

      test('should keep the entry when the credential delete throws', () async {
        // Arrange
        final credentials = _FailingCredentialStore();
        final registry = PreferencesDaemonRegistry(_preferences, credentials);
        final added = await registry.add(name: 'local', baseUrl: 'http://localhost:31415');

        // Act
        await expectLater(registry.remove(added.id), throwsA(isA<StateError>()));
        final daemons = await registry.list();

        // Assert
        expect(daemons.length, 1);
        expect(daemons.single.id, 'd1');
        expect(credentials.deleted, <String>['d1']);
      });

      test('should keep the selection when the credential delete throws', () async {
        // Arrange
        final credentials = _FailingCredentialStore();
        final registry = PreferencesDaemonRegistry(_preferences, credentials);
        final added = await registry.add(name: 'local', baseUrl: 'http://localhost:31415');
        await registry.select(added.id);

        // Act
        await expectLater(registry.remove(added.id), throwsA(isA<StateError>()));
        final selected = await registry.selected();

        // Assert
        expect(selected, added);
      });
    });
  });
}
```

**Action — GREEN:** the software-engineer's Task 005.5 creates the seam.

### Task 005.4 — the seed test

**Input:** `test/app/settings/daemon_registry_seed_test.dart`

**Action — RED:** write the file verbatim.

```dart
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/app/env/env.dart';
import 'package:kanthord/app/settings/daemon_registry.dart';
import 'package:kanthord/app/token/memory_daemon_credential_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

const String _kRegistryFile = 'lib/app/settings/daemon_registry.dart';
const String _kSettingsDir = 'lib/app/settings';

late SharedPreferences _preferences;
late MemoryDaemonCredentialStore _credentials;

PreferencesDaemonRegistry _registry() =>
    PreferencesDaemonRegistry(_preferences, _credentials);

List<String> _handWrittenSettingsSources() => Directory(_kSettingsDir)
    .listSync()
    .whereType<File>()
    .map((file) => file.path)
    .where((path) => path.endsWith('.dart'))
    .where((path) => !path.endsWith('.freezed.dart') && !path.endsWith('.g.dart'))
    .toList()
  ..sort();

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    _preferences = await SharedPreferences.getInstance();
    _credentials = MemoryDaemonCredentialStore();
  });

  group('PreferencesDaemonRegistry', () {
    group('seedDefault', () {
      test('should insert one daemon when the registry is empty', () async {
        // Arrange
        final registry = _registry();

        // Act
        await registry.seedDefault();
        final daemons = await registry.list();

        // Assert
        expect(daemons.length, 1);
        expect(daemons.single.name, kSeedDaemonName);
        expect(daemons.single.baseUrl, Env.apiEndpoint);
      });

      test('should select the seeded daemon when the registry is empty', () async {
        // Arrange
        final registry = _registry();

        // Act
        await registry.seedDefault();
        final selected = await registry.selected();

        // Assert
        expect(selected, isNotNull);
        expect(selected!.name, kSeedDaemonName);
      });

      test('should confirm nothing when the daemon is seeded', () async {
        // Arrange
        final registry = _registry();

        // Act
        await registry.seedDefault();
        final selected = await registry.selected();

        // Assert
        expect(selected!.confirmedAt, isNull);
      });

      test('should write no token when the daemon is seeded', () async {
        // Arrange
        final registry = _registry();

        // Act
        await registry.seedDefault();
        final token = await _credentials.read('d1');

        // Assert
        expect(token, isNull);
      });

      test('should add nothing when the registry already holds a daemon', () async {
        // Arrange
        final registry = _registry();
        await registry.add(name: 'vps', baseUrl: 'http://10.0.0.2:31415');

        // Act
        await registry.seedDefault();
        final daemons = await registry.list();

        // Assert
        expect(daemons.length, 1);
        expect(daemons.single.name, 'vps');
      });

      test('should select nothing when the registry already holds a daemon', () async {
        // Arrange
        final registry = _registry();
        await registry.add(name: 'vps', baseUrl: 'http://10.0.0.2:31415');

        // Act
        await registry.seedDefault();
        final selectedId = await registry.selectedId();

        // Assert
        expect(selectedId, isNull);
      });

      test('should keep the selection when the second start seeds nothing', () async {
        // Arrange
        final registry = _registry();
        await registry.seedDefault();
        final first = await registry.selectedId();

        // Act
        final second = _registry();
        await second.seedDefault();
        final daemons = await second.list();

        // Assert
        expect(first, 'd1');
        expect(await second.selectedId(), 'd1');
        expect(daemons.length, 1);
      });
    });

    group('the env reference', () {
      test('should reference the env class when the registry source is read', () {
        // Arrange
        final source = File(_kRegistryFile).readAsStringSync();

        // Act
        final references = source.contains('Env.apiEndpoint');

        // Assert
        expect(references, isTrue);
      });

      test('should reference the env class in no other settings file when the sources '
          'are read', () {
        // Arrange
        final sources = _handWrittenSettingsSources()
            .where((path) => !path.endsWith('daemon_registry.dart'));

        // Act
        final offenders = sources
            .where((path) => File(path).readAsStringSync().contains('Env.'))
            .toList();

        // Assert
        expect(offenders, isEmpty);
      });
    });
  });
}
```

**Action — GREEN:** the software-engineer's Task 005.5 creates the seam.

### Task 005.5 — the registry

**Input:** `lib/app/settings/daemon_registry.dart`

**Action — GREEN:** write the file exactly as the `## Change` section states.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/app/settings/daemon_registry_test.dart` exits 0.
- `make test-one T=test/app/settings/daemon_registry_selection_test.dart` exits 0.
- `make test-one T=test/app/settings/daemon_registry_remove_test.dart` exits 0.
- `make test-one T=test/app/settings/daemon_registry_seed_test.dart` exits 0.
- `make test-one T=test/app/settings` exits 0 — the whole directory, `daemon_test.dart` of Story `03`
  included.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: `PASS 002-G3-REGISTRY`, `PASS 002-G4-UNSELECTED`, `PASS 002-G5-SEED`, `PASS 002-G6-REMOVE`.
