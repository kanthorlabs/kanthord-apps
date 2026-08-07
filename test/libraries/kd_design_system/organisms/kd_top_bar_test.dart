import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/libraries/kd_design_system/organisms/kd_top_bar.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_theme.dart';

Future<void> _pumpAt(WidgetTester tester, Size size, KDTopBar topBar) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: KDTheme.light(),
      home: Scaffold(appBar: topBar, body: const Text('body')),
    ),
  );
}

void main() {
  group('KDTopBar', () {
    group('build', () {
      testWidgets('should render the wordmark when the width is 700', (tester) async {
        // Arrange
        const topBar = KDTopBar(title: 'Nodes');

        // Act
        await _pumpAt(tester, const Size(700, 900), topBar);

        // Assert
        expect(find.text('KanthorD'), findsOneWidget);
        expect(find.text('Nodes'), findsOneWidget);
      });

      testWidgets('should render no wordmark when the width is below 600', (tester) async {
        // Arrange
        const topBar = KDTopBar(title: 'Nodes');

        // Act
        await _pumpAt(tester, const Size(599, 900), topBar);

        // Assert
        expect(find.text('KanthorD'), findsNothing);
        expect(find.text('Nodes'), findsOneWidget);
      });

      testWidgets('should render the status label when the width is 700', (tester) async {
        // Arrange
        const topBar = KDTopBar(title: 'Nodes', status: KDConnectionStatus.degraded);

        // Act
        await _pumpAt(tester, const Size(700, 900), topBar);

        // Assert
        expect(find.text('Degraded'), findsOneWidget);
      });

      testWidgets('should render no status label when the width is below 600', (tester) async {
        // Arrange
        const topBar = KDTopBar(title: 'Nodes', status: KDConnectionStatus.degraded);

        // Act
        await _pumpAt(tester, const Size(599, 900), topBar);

        // Assert
        expect(find.text('Degraded'), findsNothing);
        expect(find.byIcon(Icons.warning_amber_outlined), findsOneWidget);
      });

      testWidgets('should render no status indicator when status is null', (tester) async {
        // Arrange
        const topBar = KDTopBar(title: 'Nodes');

        // Act
        await _pumpAt(tester, const Size(700, 900), topBar);

        // Assert
        expect(find.byType(Chip), findsNothing);
        expect(find.byType(ActionChip), findsNothing);
      });

      testWidgets('should render a plain chip when onStatusPressed is null', (tester) async {
        // Arrange
        const topBar = KDTopBar(status: KDConnectionStatus.connected);

        // Act
        await _pumpAt(tester, const Size(700, 900), topBar);

        // Assert
        expect(find.byType(Chip), findsOneWidget);
        expect(find.byType(ActionChip), findsNothing);
      });

      testWidgets('should render an action chip when onStatusPressed is set', (tester) async {
        // Arrange
        final topBar = KDTopBar(status: KDConnectionStatus.connected, onStatusPressed: () {});

        // Act
        await _pumpAt(tester, const Size(700, 900), topBar);

        // Assert
        expect(find.byType(ActionChip), findsOneWidget);
      });

      testWidgets('should render a progress indicator when the status is connecting', (
        tester,
      ) async {
        // Arrange
        const topBar = KDTopBar(status: KDConnectionStatus.connecting);

        // Act
        await _pumpAt(tester, const Size(700, 900), topBar);

        // Assert
        expect(find.byType(CircularProgressIndicator), findsOneWidget);
      });

      testWidgets('should render the actions when actions is not empty', (tester) async {
        // Arrange
        final topBar = KDTopBar(
          title: 'Nodes',
          actions: [IconButton(onPressed: () {}, icon: const Icon(Icons.refresh))],
        );

        // Act
        await _pumpAt(tester, const Size(700, 900), topBar);

        // Assert
        expect(find.byIcon(Icons.refresh), findsOneWidget);
      });
    });

    group('onStatusPressed', () {
      testWidgets('should fire when the status chip is tapped', (tester) async {
        // Arrange
        var pressed = 0;

        // Act
        await _pumpAt(
          tester,
          const Size(700, 900),
          KDTopBar(status: KDConnectionStatus.unauthorized, onStatusPressed: () => pressed++),
        );
        await tester.tap(find.byType(ActionChip));
        await tester.pumpAndSettle();

        // Assert
        expect(pressed, 1);
      });

      testWidgets('should fire when the icon-only status is tapped below 600', (tester) async {
        // Arrange
        var pressed = 0;

        // Act
        await _pumpAt(
          tester,
          const Size(599, 900),
          KDTopBar(status: KDConnectionStatus.unauthorized, onStatusPressed: () => pressed++),
        );
        await tester.tap(find.byIcon(Icons.lock_outline));
        await tester.pumpAndSettle();

        // Assert
        expect(pressed, 1);
      });
    });
  });
}
