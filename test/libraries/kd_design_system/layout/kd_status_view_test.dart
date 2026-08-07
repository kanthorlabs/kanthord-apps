import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/libraries/kd_design_system/layout/kd_status_view.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_theme.dart';

Future<void> _pump(WidgetTester tester, Widget view) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(900, 700);
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: KDTheme.light(),
      home: Scaffold(body: view),
    ),
  );
}

void main() {
  group('KDStatusView', () {
    group('build', () {
      testWidgets('should render a progress indicator when the kind is loading', (tester) async {
        // Arrange
        const view = KDStatusView(kind: KDStatusKind.loading, title: 'Reading the node list');

        // Act
        await _pump(tester, view);

        // Assert
        expect(find.byType(CircularProgressIndicator), findsOneWidget);
        expect(find.text('Reading the node list'), findsOneWidget);
      });

      testWidgets('should render the inbox glyph when the kind is empty', (tester) async {
        // Arrange
        const view = KDStatusView(kind: KDStatusKind.empty, title: 'No node matches the filter');

        // Act
        await _pump(tester, view);

        // Assert
        expect(find.byIcon(Icons.inbox_outlined), findsOneWidget);
        expect(find.byType(CircularProgressIndicator), findsNothing);
      });

      testWidgets('should render the title, the message and the actions when the kind is error', (
        tester,
      ) async {
        // Arrange
        final view = KDStatusView(
          kind: KDStatusKind.error,
          title: 'The daemon is unreachable',
          message: 'Check the base URL.',
          actions: [FilledButton(onPressed: () {}, child: const Text('Retry'))],
        );

        // Act
        await _pump(tester, view);

        // Assert
        expect(find.text('The daemon is unreachable'), findsOneWidget);
        expect(find.text('Check the base URL.'), findsOneWidget);
        expect(find.text('Retry'), findsOneWidget);
      });

      testWidgets('should paint the glyph in the error role when the kind is error', (
        tester,
      ) async {
        // Arrange
        const view = KDStatusView(kind: KDStatusKind.error, title: 'The daemon is unreachable');

        // Act
        await _pump(tester, view);

        // Assert
        final icon = tester.widget<Icon>(find.byIcon(Icons.error_outline));
        expect(icon.color, KDTheme.light().colorScheme.error);
      });

      testWidgets('should paint no error color when the kind is notImplemented', (tester) async {
        // Arrange
        const view = KDStatusView(
          kind: KDStatusKind.notImplemented,
          title: 'The daemon does not do this yet',
        );

        // Act
        await _pump(tester, view);

        // Assert
        final scheme = KDTheme.light().colorScheme;
        final icon = tester.widget<Icon>(find.byIcon(Icons.construction_outlined));
        expect(icon.color, scheme.onSurfaceVariant);
        expect(icon.color, isNot(scheme.error));
      });

      testWidgets('should render no action row when actions is empty', (tester) async {
        // Arrange
        const view = KDStatusView(kind: KDStatusKind.empty, title: 'No node matches the filter');

        // Act
        await _pump(tester, view);

        // Assert
        expect(find.byType(Wrap), findsNothing);
      });
    });
  });
}
