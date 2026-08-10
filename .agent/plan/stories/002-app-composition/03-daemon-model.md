# Story 03 — the `Daemon` model

Epic: `.agent/plan/epics/002-app-composition.md`
Depends on: none.

## Change

### Human pre-step — `build.yaml`. **APPLIED**

`scripts/lane-check.sh:43` denies `build.yaml` to every role, so the human applied it. Before the
edit, `freezed` ran over `lib/api/models/**.dart` plus `lib/features/**_state.dart` and
`json_serializable` over `lib/api/models/**.dart` alone; `lib/app/settings/daemon.dart` matched
neither, so `make generate-lib` wrote no `daemon.freezed.dart` and no `daemon.g.dart` and the file
could not compile.

`build.yaml:8-21` now reads exactly this, indentation included. Both keys sit under
`targets:` > `$default:` > `builders:`, at six spaces:

<!-- prettier-ignore -->
```text
      freezed:freezed:
        enabled: true
        generate_for:
          - lib/api/models/**.dart
          - lib/app/settings/**.dart
          - lib/features/**_state.dart
      json_serializable:
        enabled: true
        generate_for:
          - lib/api/models/**.dart
          - lib/app/settings/**.dart
        options:
          explicit_to_json: true
          create_to_json: true
          include_if_null: false
```

The added lines are the two `- lib/app/settings/**.dart` entries and nothing else. No `options:` value
changed. `include_if_null: false` is load-bearing: it omits a null `confirmedAt`
from the persisted JSON.

### `lib/**`

- New `lib/app/settings/daemon.dart`:

  ```dart
  import 'package:freezed_annotation/freezed_annotation.dart';

  part 'daemon.freezed.dart';
  part 'daemon.g.dart';

  @freezed
  abstract class Daemon with _$Daemon {
    const factory Daemon({
      @JsonKey(name: 'id') required String id,
      @JsonKey(name: 'name') required String name,
      @JsonKey(name: 'baseUrl') required String baseUrl,
      @JsonKey(name: 'confirmedAt') DateTime? confirmedAt,
    }) = _Daemon;

    factory Daemon.fromJson(Map<String, dynamic> json) => _$DaemonFromJson(json);
  }
  ```

### Codegen

The software-engineer runs `make generate-lib` after writing `lib/app/settings/daemon.dart`. The
expected diff adds `lib/app/settings/daemon.freezed.dart` and `lib/app/settings/daemon.g.dart`, and
both are committed. Never `make generate`.

## Constraints

- It lives in `lib/app/settings/`, never in `lib/api/models/`. It is app configuration and no daemon
  route returns it. `lib/api/` imports nothing from `lib/app/`.
- `@JsonKey(name:)` on every field, and no `fieldRename`. The four names are exactly `id`, `name`,
  `baseUrl` and `confirmedAt`.
- `confirmedAt` is the one nullable field. `id`, `name` and `baseUrl` are `required` and
  non-nullable.
- `Daemon` is a value only. It reads no storage, calls no daemon and generates no `id`. Story `05`
  owns id generation, and EPIC 003 owns the `confirmedAt` write.
- `json_serializable` maps `DateTime` through `DateTime.parse` and `toIso8601String()`. A round trip
  therefore preserves the instant, not the original string spelling, so every test pins a UTC
  literal.
- `lib/app/settings/daemon.dart` holds no `Env.` reference.
- No comment in the file. `scripts/arch-check.sh:88-89` filters the comment ban to
  `lib/(api|features)/`, so it does not catch `lib/app/`, and CLAUDE.md still forbids the comment.

## Tasks

### Task 003.1 — the model test

**Input:** `test/app/settings/daemon_test.dart`

**Action — RED:** write the file verbatim.

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/app/settings/daemon.dart';

const Daemon _kUnconfirmed = Daemon(
  id: 'd1',
  name: 'local',
  baseUrl: 'http://localhost:31415',
);

final Daemon _kConfirmed = Daemon(
  id: 'd2',
  name: 'vps',
  baseUrl: 'http://10.0.0.2:31415',
  confirmedAt: DateTime.utc(2026, 1, 1, 12),
);

void main() {
  group('Daemon', () {
    group('constructor', () {
      test('should hold the four fields when it is constructed', () {
        // Arrange
        final daemon = _kConfirmed;

        // Act
        final confirmedAt = daemon.confirmedAt;

        // Assert
        expect(daemon.id, 'd2');
        expect(daemon.name, 'vps');
        expect(daemon.baseUrl, 'http://10.0.0.2:31415');
        expect(confirmedAt, DateTime.utc(2026, 1, 1, 12));
      });

      test('should hold a null confirmed instant when it is not given', () {
        // Arrange
        const daemon = _kUnconfirmed;

        // Act
        final confirmedAt = daemon.confirmedAt;

        // Assert
        expect(confirmedAt, isNull);
      });
    });

    group('equality', () {
      test('should be equal when the four fields match', () {
        // Arrange
        const first = Daemon(id: 'd1', name: 'local', baseUrl: 'http://localhost:31415');
        const second = Daemon(id: 'd1', name: 'local', baseUrl: 'http://localhost:31415');

        // Act
        final equal = first == second;

        // Assert
        expect(equal, isTrue);
        expect(first.hashCode, second.hashCode);
      });

      test('should not be equal when the id differs', () {
        // Arrange
        const first = Daemon(id: 'd1', name: 'local', baseUrl: 'http://localhost:31415');
        const second = Daemon(id: 'd2', name: 'local', baseUrl: 'http://localhost:31415');

        // Act
        final equal = first == second;

        // Assert
        expect(equal, isFalse);
      });
    });

    group('copyWith', () {
      test('should keep the id when the name and the base URL change', () {
        // Arrange
        const daemon = _kUnconfirmed;

        // Act
        final edited = daemon.copyWith(name: 'renamed', baseUrl: 'http://10.0.0.9:31415');

        // Assert
        expect(edited.id, 'd1');
        expect(edited.name, 'renamed');
        expect(edited.baseUrl, 'http://10.0.0.9:31415');
      });
    });

    group('toJson', () {
      test('should write the four wire names when the daemon is confirmed', () {
        // Arrange
        final daemon = _kConfirmed;

        // Act
        final json = daemon.toJson();

        // Assert
        expect(json['id'], 'd2');
        expect(json['name'], 'vps');
        expect(json['baseUrl'], 'http://10.0.0.2:31415');
        expect(json['confirmedAt'], '2026-01-01T12:00:00.000Z');
      });

      test('should omit the confirmed instant when it is null', () {
        // Arrange
        const daemon = _kUnconfirmed;

        // Act
        final json = daemon.toJson();

        // Assert
        expect(json.containsKey('confirmedAt'), isFalse);
      });
    });

    group('fromJson', () {
      test('should read the four fields when every key is present', () {
        // Arrange
        final json = <String, dynamic>{
          'id': 'd2',
          'name': 'vps',
          'baseUrl': 'http://10.0.0.2:31415',
          'confirmedAt': '2026-01-01T12:00:00.000Z',
        };

        // Act
        final daemon = Daemon.fromJson(json);

        // Assert
        expect(daemon, _kConfirmed);
      });

      test('should read a null confirmed instant when the key is absent', () {
        // Arrange
        final json = <String, dynamic>{
          'id': 'd1',
          'name': 'local',
          'baseUrl': 'http://localhost:31415',
        };

        // Act
        final daemon = Daemon.fromJson(json);

        // Assert
        expect(daemon, _kUnconfirmed);
      });

      test('should return the same daemon when it round trips through JSON', () {
        // Arrange
        final daemon = _kConfirmed;

        // Act
        final result = Daemon.fromJson(daemon.toJson());

        // Assert
        expect(result, daemon);
      });
    });
  });
}
```

**Action — GREEN:** the software-engineer's Task 003.2 creates the seam.

### Task 003.2 — the model

**Input:** `lib/app/settings/daemon.dart`

**Action — GREEN:** write the file exactly as the `## Change` section states, then run
`make generate-lib` and keep `lib/app/settings/daemon.freezed.dart` and
`lib/app/settings/daemon.g.dart`.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/app/settings/daemon_test.dart` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: this Story delivers no `PASS` line of its own. `PASS 002-G3-REGISTRY` runs
  `make test-one T=test/app/settings`, which is the whole directory, so `daemon_test.dart` runs inside
  it. Story `05` owns that marker.
