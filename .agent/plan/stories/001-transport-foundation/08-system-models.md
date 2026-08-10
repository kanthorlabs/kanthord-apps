# Story 08 — The `system` models

Epic: `.agent/plan/epics/001-transport-foundation.md`
Depends on: Story 07 (`WireEnum`, `HealthStatusConverter`, `DependencyStatusConverter`).

Schema: `docs/api/contract/features/system.yaml`, `system.health.response` and `system.db.response`.

## Change

- New `lib/api/models/health_dependency.dart`:

  ```dart
  import 'package:freezed_annotation/freezed_annotation.dart';

  import 'dependency_status.dart';
  import 'wire_enum.dart';

  part 'health_dependency.freezed.dart';
  part 'health_dependency.g.dart';

  @freezed
  abstract class HealthDependency with _$HealthDependency {
    const factory HealthDependency({
      @JsonKey(name: 'name') required String name,
      @JsonKey(name: 'status') @DependencyStatusConverter() required WireEnum<DependencyStatus> status,
    }) = _HealthDependency;

    factory HealthDependency.fromJson(Map<String, dynamic> json) =>
        _$HealthDependencyFromJson(json);
  }
  ```

- New `lib/api/models/health.dart` — the same shape, with:

  ```dart
  @JsonKey(name: 'status') @HealthStatusConverter() required WireEnum<HealthStatus> status,
  @JsonKey(name: 'dependencies') required List<HealthDependency> dependencies,
  ```

- New `lib/api/models/migration.dart` — the same shape, with:

  ```dart
  @JsonKey(name: 'version') required int version,
  @JsonKey(name: 'name') required String name,
  @JsonKey(name: 'applied') required bool applied,
  @JsonKey(name: 'appliedAt') required int? appliedAt,
  ```

- New `lib/api/models/db_status.dart` — the same shape, with:

  ```dart
  @JsonKey(name: 'migrations') required List<Migration> migrations,
  ```

- Run `make generate-lib` in the same turn. The eight generated files —
  `health.freezed.dart`, `health.g.dart`, `health_dependency.freezed.dart`,
  `health_dependency.g.dart`, `migration.freezed.dart`, `migration.g.dart`,
  `db_status.freezed.dart`, `db_status.g.dart` — are part of the diff and are committed.

## Constraints

- One model per file. Four models, four files.
- `@JsonKey(name:)` on every field. No `field_rename`. `docs/api/conventions.md`.
- `appliedAt` is a nullable epoch-millisecond `int`, and it is a **required** named parameter that
  accepts null. The schema declares it required and nullable.
- An unknown JSON field is ignored, never a decode failure. `json_serializable` does this by default;
  add no `disallowUnrecognizedKeys`.
- Write no model for `system.status`. It carries a schema and no handler, and EPIC 006 owns it.
- Write no `toJson` call site here. `build.yaml` sets `create_to_json: true`, so the generated
  `toJson` exists and is unused in this EPIC.

## Tasks

### Task 008.1 — the decode tests

**Input:** `test/api/models/health_test.dart`, `test/api/models/db_status_test.dart`

**Action — RED:**

- `test/api/models/health_test.dart`, group `Health`, nested group `fromJson`:
  - `'should decode the status and the dependencies when the daemon reports ok'` — decode
    `{'status': 'ok', 'dependencies': [{'name': 'storage', 'status': 'ok'}]}`; assert
    `health.status.known` equals `HealthStatus.ok`, `dependencies` has length 1, the dependency
    `name` equals `'storage'` and its `status.known` equals `DependencyStatus.ok`.
  - `'should decode the degraded roll-up when a dependency failed'` — `'degraded'` plus a
    `'failed'` dependency; assert both known cases.
  - `'should keep the raw value when the status is unknown'` — `{'status': 'sideways', 'dependencies': []}`;
    assert `status.known` is null, `status.raw` equals `'sideways'`, and no throw.
  - `'should ignore an unknown field when the daemon adds one'` — the ok body plus
    `'futureField': 1`; assert it decodes.
- `test/api/models/db_status_test.dart`, group `DbStatus`, nested group `fromJson`:
  - `'should decode a migration when appliedAt is a number'` — one migration with
    `appliedAt: 1738368000000`; assert `version`, `name`, `applied` and `appliedAt`.
  - `'should decode a migration when appliedAt is null'` — assert `appliedAt` is null.
  - `'should decode an empty list when the daemon reports no migration'` — `{'migrations': []}`.

**Action — GREEN:** the software-engineer's Task 008.2 creates the seam.

### Task 008.2 — the four models

**Input:** `lib/api/models/health.dart`, `lib/api/models/health_dependency.dart`,
`lib/api/models/db_status.dart`, `lib/api/models/migration.dart`

**Action — GREEN:** write the four files exactly as the `## Change` section states, then run
`make generate-lib` and commit the eight generated files.

**Action — REFACTOR:** none.

## Verify

- `make test-one T=test/api/models/health_test.dart` exits 0.
- `make test-one T=test/api/models/db_status_test.dart` exits 0.
- `scripts/verify-handoff.sh software-engineer` reports `VERIFY: PASS`.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: none of its own. It is the precondition of `PASS 001-G7-SYSTEM`.
