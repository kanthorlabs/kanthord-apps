# Story 05 — the health view

Epic: `.agent/plan/epics/003-daemon-connect.md`
Depends on: EPIC 001 (`Health`, `HealthDependency`, `WireEnum`).

Atomic layer: a **page**. It composes `KDText` and `KDCard` and defines no atom. It builds no raw
Material widget, so `DESIGNS.md:50` holds by construction and not only by the `arch-check` grep.

## Change

### `lib/**`

New file `lib/features/daemon_connect/connect/widgets/health_view.dart`, verbatim:

```dart
import 'package:flutter/material.dart';

import '../../../../api/api.dart';
import '../../../../libraries/kd_design_system/kd_design_system.dart';

final class HealthView extends StatelessWidget {
  const HealthView({required this.health, super.key});

  final Health health;

  KDTextTone _dependencyTone(WireEnum<DependencyStatus> status) {
    return switch (status.known) {
      DependencyStatus.ok => KDTextTone.primary,
      DependencyStatus.failed => KDTextTone.error,
      DependencyStatus.notImplemented => KDTextTone.secondary,
      null => KDTextTone.secondary,
    };
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KDText(health.status.raw, role: KDTextRole.titleMedium),
        SizedBox(height: tokens.spacing.md),
        for (final dependency in health.dependencies) ...[
          KDCard(
            title: dependency.name,
            trailing: KDText(
              dependency.status.raw,
              role: KDTextRole.labelLarge,
              tone: _dependencyTone(dependency.status),
            ),
          ),
          SizedBox(height: tokens.spacing.sm),
        ],
      ],
    );
  }
}
```

### `test/**`

New file `test/features/daemon_connect/connect/widgets/health_view_test.dart`, verbatim:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/models/dependency_status.dart';
import 'package:kanthord/api/models/health.dart';
import 'package:kanthord/api/models/health_dependency.dart';
import 'package:kanthord/api/models/health_status.dart';
import 'package:kanthord/features/daemon_connect/connect/widgets/health_view.dart';
import 'package:kanthord/libraries/kd_design_system/atoms/kd_text.dart';
import 'package:kanthord/libraries/kd_design_system/molecules/kd_card.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_theme.dart';

HealthDependency _dependency(String name, String status) => HealthDependency(
  name: name,
  status: const DependencyStatusConverter().fromJson(status),
);

Health _health(String status, List<HealthDependency> dependencies) => Health(
  status: const HealthStatusConverter().fromJson(status),
  dependencies: dependencies,
);

Future<void> _pump(WidgetTester tester, Health health) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(1280, 900);
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: KDTheme.light(),
      home: Scaffold(body: SingleChildScrollView(child: HealthView(health: health))),
    ),
  );
}

KDTextTone _toneOf(WidgetTester tester, String name) {
  final card = tester.widget<KDCard>(
    find.ancestor(of: find.text(name), matching: find.byType(KDCard)),
  );
  return (card.trailing! as KDText).tone;
}

void main() {
  group('HealthView', () {
    group('the roll-up', () {
      testWidgets('should render the roll-up status when the body is decoded', (tester) async {
        // Arrange
        final health = _health('degraded', <HealthDependency>[]);

        // Act
        await _pump(tester, health);

        // Assert
        expect(find.text('degraded'), findsOneWidget);
      });

      testWidgets('should render the raw roll-up when the status is unknown', (tester) async {
        // Arrange
        final health = _health('draining', <HealthDependency>[]);

        // Act
        await _pump(tester, health);

        // Assert
        expect(find.text('draining'), findsOneWidget);
      });
    });

    group('the dependency list', () {
      testWidgets('should render every dependency in the order the daemon returned them', (
        tester,
      ) async {
        // Arrange
        final health = _health('degraded', <HealthDependency>[
          _dependency('storage', 'ok'),
          _dependency('git', 'failed'),
          _dependency('agent', 'not-implemented'),
        ]);

        // Act
        await _pump(tester, health);

        // Assert
        expect(find.byType(KDCard), findsNWidgets(3));
        expect(
          tester.getTopLeft(find.text('storage')).dy,
          lessThan(tester.getTopLeft(find.text('git')).dy),
        );
        expect(
          tester.getTopLeft(find.text('git')).dy,
          lessThan(tester.getTopLeft(find.text('agent')).dy),
        );
      });

      testWidgets('should render ok as the primary tone when a dependency is ok', (tester) async {
        // Arrange
        final health = _health('ok', <HealthDependency>[_dependency('storage', 'ok')]);

        // Act
        await _pump(tester, health);

        // Assert
        expect(_toneOf(tester, 'storage'), KDTextTone.primary);
      });

      testWidgets('should render failed as the error tone when a dependency failed', (
        tester,
      ) async {
        // Arrange
        final health = _health('degraded', <HealthDependency>[_dependency('git', 'failed')]);

        // Act
        await _pump(tester, health);

        // Assert
        expect(_toneOf(tester, 'git'), KDTextTone.error);
      });

      testWidgets('should render not-implemented as neither ok nor a failure', (tester) async {
        // Arrange
        final health = _health('ok', <HealthDependency>[
          _dependency('agent', 'not-implemented'),
        ]);

        // Act
        await _pump(tester, health);

        // Assert
        expect(find.text('not-implemented'), findsOneWidget);
        expect(_toneOf(tester, 'agent'), KDTextTone.secondary);
        expect(_toneOf(tester, 'agent'), isNot(KDTextTone.primary));
        expect(_toneOf(tester, 'agent'), isNot(KDTextTone.error));
      });

      testWidgets('should render the raw status when a dependency status is unknown', (
        tester,
      ) async {
        // Arrange
        final health = _health('ok', <HealthDependency>[_dependency('cache', 'warming')]);

        // Act
        await _pump(tester, health);

        // Assert
        expect(find.text('warming'), findsOneWidget);
        expect(_toneOf(tester, 'cache'), KDTextTone.secondary);
      });
    });
  });
}
```

## Constraints

- The widget renders `health.dependencies` in the order the list holds. It never sorts and never
  filters. The daemon already orders by `name` bytewise (`docs/api/operations.md:49`), and the view
  does not restate that rule.
- Every status renders `status.raw`, so an unknown wire value survives the screen. This is the
  open-enum representation EPIC 001 fixed (`lib/api/models/wire_enum.dart:5-20`).
- Status is carried by `KDTextTone` on a `KDText`, never by a raw `Icon` and never by a colour the
  feature picks. `KDText` resolves the tone from the scheme
  (`libraries/kd_design_system/atoms/kd_text.dart:26-31`).
- The widget is a `Column`, never a `ListView`. `KDCardList` is an unbounded `ListView` and it
  overflows inside the `SingleChildScrollView` of `KDFullScreenLayout`.
- The file holds no comment.

## Verify

- `make test-one T=test/features/daemon_connect/connect/widgets/health_view_test.dart` exits 0.
- `make arch-check` exits 0.
- `make verify` exits 0.
- Proof: contributes to `PASS 003-G7-HEALTH-RENDER`. Story 08 repeats the order, the
  `not-implemented` case and the unknown case inside `connect_page_test.dart`, which is the file the
  Proof marker runs.

## Tasks

### Task 005.1 — the health view test

**Input:** `test/features/daemon_connect/connect/widgets/health_view_test.dart`

**Action — RED:** write the file verbatim.

**Action — GREEN:** Task 005.2 creates the seam.

### Task 005.2 — the health view

**Input:** `lib/features/daemon_connect/connect/widgets/health_view.dart`

**Action — GREEN:** write the file verbatim.

**Action — REFACTOR:** none.
