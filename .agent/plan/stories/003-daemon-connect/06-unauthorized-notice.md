# Story 06 — the unauthorized state

> **SUPERSEDED on 2026-08-10 — re-expand before implementing.** The product holds more than
> one daemon, and `KanthordApi.withCandidate` replaces `ProbeClientBuilder`. Read the STOP
> block in `index.md` for this file's delta specification. Everything below still shows the
> shape, the guards and the tests that survive.

Epic: `.agent/plan/epics/003-daemon-connect.md`
Depends on: Story 01 (`ConnectState`).

Atomic layer: a **page part**. It composes `KDStatusView` and `KDText`.

## Change

### `lib/**`

New file `lib/features/daemon_connect/connect/widgets/unauthorized_notice.dart`, verbatim:

```dart
import 'package:flutter/material.dart';

import '../../../../libraries/kd_design_system/kd_design_system.dart';

final class UnauthorizedNotice extends StatelessWidget {
  const UnauthorizedNotice({required this.baseUrl, required this.detail, super.key});

  final String baseUrl;
  final String detail;

  @override
  Widget build(BuildContext context) {
    return KDStatusView(
      kind: KDStatusKind.error,
      title: 'The daemon refused the token',
      message: detail,
      actions: <Widget>[
        KDText(baseUrl, role: KDTextRole.bodyMedium, tone: KDTextTone.secondary),
        const KDText(
          'Enter the token again, then press Connect.',
          role: KDTextRole.bodySmall,
          tone: KDTextTone.secondary,
        ),
      ],
    );
  }
}
```

### `test/**`

New file `test/features/daemon_connect/connect/widgets/unauthorized_notice_test.dart`, verbatim:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/features/daemon_connect/connect/widgets/unauthorized_notice.dart';
import 'package:kanthord/libraries/kd_design_system/layout/kd_status_view.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_theme.dart';

Future<void> _pump(WidgetTester tester, UnauthorizedNotice notice) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(1280, 900);
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: KDTheme.light(),
      home: Scaffold(body: SingleChildScrollView(child: notice)),
    ),
  );
}

void main() {
  group('UnauthorizedNotice', () {
    group('build', () {
      testWidgets('should show the current base URL when the token is refused', (tester) async {
        // Arrange
        const notice = UnauthorizedNotice(
          baseUrl: 'http://localhost:31415',
          detail: 'the daemon refused the token',
        );

        // Act
        await _pump(tester, notice);

        // Assert
        expect(find.text('http://localhost:31415'), findsOneWidget);
      });

      testWidgets('should name the token when the token is refused', (tester) async {
        // Arrange
        const notice = UnauthorizedNotice(
          baseUrl: 'http://localhost:31415',
          detail: 'the daemon refused the token',
        );

        // Act
        await _pump(tester, notice);

        // Assert
        expect(find.text('The daemon refused the token'), findsOneWidget);
        expect(find.text('the daemon refused the token'), findsOneWidget);
      });

      testWidgets('should offer to enter the token again when the token is refused', (
        tester,
      ) async {
        // Arrange
        const notice = UnauthorizedNotice(
          baseUrl: 'http://localhost:31415',
          detail: 'the daemon refused the token',
        );

        // Act
        await _pump(tester, notice);

        // Assert
        expect(find.text('Enter the token again, then press Connect.'), findsOneWidget);
        expect(
          tester.widget<KDStatusView>(find.byType(KDStatusView)).kind,
          KDStatusKind.error,
        );
      });

      testWidgets('should offer no clear control when the token is refused', (tester) async {
        // Arrange
        const notice = UnauthorizedNotice(
          baseUrl: 'http://localhost:31415',
          detail: 'the daemon refused the token',
        );

        // Act
        await _pump(tester, notice);

        // Assert
        expect(find.text('Clear the token'), findsNothing);
      });
    });
  });
}
```

## Constraints

- The notice clears nothing and signs nothing out. The settings dialog of Story 07 is the only place
  that clears the token. EPIC G8.
- The notice takes no callback. It is a display widget.
- The file holds no comment and hard-codes no design value.

## Verify

- `make test-one T=test/features/daemon_connect/connect/widgets/unauthorized_notice_test.dart`
  exits 0.
- `make verify` exits 0.
- Proof: contributes to `PASS 003-G8-SETTINGS` through the connect page of Story 08.

## Tasks

### Task 006.1 — the notice test

**Input:** `test/features/daemon_connect/connect/widgets/unauthorized_notice_test.dart`

**Action — RED:** write the file verbatim.

**Action — GREEN:** Task 006.2 creates the seam.

### Task 006.2 — the notice

**Input:** `lib/features/daemon_connect/connect/widgets/unauthorized_notice.dart`

**Action — GREEN:** write the file verbatim.

**Action — REFACTOR:** none.
