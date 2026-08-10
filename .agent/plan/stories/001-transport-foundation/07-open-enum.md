# Story 07 — The open enum

Epic: `.agent/plan/epics/001-transport-foundation.md`
Depends on: Story 02 (`lib/api/` exists).

This Story is EPIC Story bullet 9. It runs before the models, because `Health.status` and
`HealthDependency.status` are typed by it.

## Change

- New `lib/api/models/wire_enum.dart` — the representation every wire enum reuses:

  ```dart
  import 'package:freezed_annotation/freezed_annotation.dart';

  part 'wire_enum.freezed.dart';

  @freezed
  abstract class WireEnum<T> with _$WireEnum<T> {
    const factory WireEnum({required T? known, required String raw}) = _WireEnum<T>;
  }

  abstract base class WireEnumConverter<T> implements JsonConverter<WireEnum<T>, String> {
    const WireEnumConverter(this._byWire);

    final Map<String, T> _byWire;

    @override
    WireEnum<T> fromJson(String json) => WireEnum<T>(known: _byWire[json], raw: json);

    @override
    String toJson(WireEnum<T> object) => object.raw;
  }
  ```

- New `lib/api/models/health_status.dart`:

  ```dart
  import 'wire_enum.dart';

  enum HealthStatus { ok, degraded }

  const _kHealthStatusByWire = <String, HealthStatus>{
    'ok': HealthStatus.ok,
    'degraded': HealthStatus.degraded,
  };

  final class HealthStatusConverter extends WireEnumConverter<HealthStatus> {
    const HealthStatusConverter() : super(_kHealthStatusByWire);
  }
  ```

- New `lib/api/models/dependency_status.dart`:

  ```dart
  import 'wire_enum.dart';

  enum DependencyStatus { ok, failed, notImplemented }

  const _kDependencyStatusByWire = <String, DependencyStatus>{
    'ok': DependencyStatus.ok,
    'failed': DependencyStatus.failed,
    'not-implemented': DependencyStatus.notImplemented,
  };

  final class DependencyStatusConverter extends WireEnumConverter<DependencyStatus> {
    const DependencyStatusConverter() : super(_kDependencyStatusByWire);
  }
  ```

- Run `make generate-lib` in the same turn. `lib/api/models/wire_enum.freezed.dart` is part of the
  diff, and it is committed.

## Constraints

- `known` is null for an unknown wire value, and `raw` always holds the wire string. There is no
  `unknown` enum member.
- `WireEnumConverter.fromJson` never throws. `docs/api/conventions.md` requires the client to
  tolerate an unknown enum value and render its raw string.
- `build.yaml` runs `freezed` and `json_serializable` over `lib/api/models/**.dart` only, so both
  new enum files live under `models/`.
- `freezed` 3.2.5 requires `abstract class` or `sealed class` on a `@freezed` declaration.
- Do not add a wire enum for `system.status`, for a node state or for a block reason. EPIC 006 reuses
  this representation for those.

## Tasks

### Task 007.1 — the open-enum test

**Input:** `test/api/models/wire_enum_test.dart`

**Action — RED:** group `WireEnumConverter`, nested group `fromJson`, with these tests:

- `'should return the known case when the wire value is ok'` — `const HealthStatusConverter().fromJson('ok')`;
  assert `known` equals `HealthStatus.ok` and `raw` equals `'ok'`.
- `'should return the known case when the wire value is degraded'` — assert `HealthStatus.degraded`.
- `'should keep the raw value and no known case when the wire value is unknown'` —
  `fromJson('sideways')`; assert `known` is null and `raw` equals `'sideways'`. Assert it does not
  throw.
- `'should map the hyphenated wire value when the dependency status is not-implemented'` —
  `const DependencyStatusConverter().fromJson('not-implemented')`; assert
  `DependencyStatus.notImplemented`.

Nested group `toJson`:

- `'should return the raw value when the case is known'` — round-trip `'ok'` and assert `toJson`
  answers `'ok'`.
- `'should return the raw value when the case is unknown'` — round-trip `'sideways'` and assert
  `toJson` answers `'sideways'`.

**Action — GREEN:** the software-engineer's Task 007.2 creates the seam.

### Task 007.2 — the representation and the two converters

**Input:** `lib/api/models/wire_enum.dart`, `lib/api/models/health_status.dart`,
`lib/api/models/dependency_status.dart`

**Action — GREEN:** write the three files exactly as the `## Change` section states, then run
`make generate-lib` and commit `lib/api/models/wire_enum.freezed.dart`.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/api/models/wire_enum_test.dart` exits 0.
- `scripts/verify-handoff.sh software-engineer` reports `VERIFY: PASS`, which proves the generated
  output is committed and unchanged.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: none of its own. It is the precondition of `PASS 001-G7-SYSTEM`.
