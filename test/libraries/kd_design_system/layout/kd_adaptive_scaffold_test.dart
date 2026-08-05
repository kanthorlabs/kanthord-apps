import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/libraries/kd_design_system/layout/kd_adaptive_scaffold.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_theme.dart';

const List<KDDestination> _kDestinations = [
  KDDestination(label: 'Chat', icon: Icons.chat_outlined, selectedIcon: Icons.chat),
  KDDestination(label: 'Agents', icon: Icons.smart_toy_outlined, selectedIcon: Icons.smart_toy),
];

Future<void> _pumpAt(WidgetTester tester, Size size) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: KDTheme.light(),
      home: KDAdaptiveScaffold(
        destinations: _kDestinations,
        selectedIndex: 0,
        onDestinationSelected: (_) {},
        body: const Text('body'),
      ),
    ),
  );
}

void main() {
  group('KDAdaptiveScaffold', () {
    group('build', () {
      testWidgets('should render bottom navigation when the width is below 600', (tester) async {
        // Arrange
        const size = Size(599, 900);

        // Act
        await _pumpAt(tester, size);

        // Assert
        expect(find.byType(NavigationBar), findsOneWidget);
        expect(find.byType(NavigationRail), findsNothing);
      });

      testWidgets('should render a navigation rail when the width is 600', (tester) async {
        // Arrange
        const size = Size(600, 900);

        // Act
        await _pumpAt(tester, size);

        // Assert
        expect(find.byType(NavigationRail), findsOneWidget);
        expect(find.byType(NavigationBar), findsNothing);
      });

      testWidgets('should render a navigation rail when the width is above 600', (tester) async {
        // Arrange
        const size = Size(1280, 900);

        // Act
        await _pumpAt(tester, size);

        // Assert
        expect(find.byType(NavigationRail), findsOneWidget);
        expect(find.byType(NavigationBar), findsNothing);
      });

      testWidgets('should render the body in both families', (tester) async {
        // Arrange
        const mobile = Size(400, 900);

        // Act
        await _pumpAt(tester, mobile);

        // Assert
        expect(find.text('body'), findsOneWidget);
      });
    });

    group('onDestinationSelected', () {
      testWidgets('should report the tapped index when a destination is tapped', (tester) async {
        // Arrange
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = const Size(400, 900);
        addTearDown(tester.view.reset);
        final selected = <int>[];

        // Act
        await tester.pumpWidget(
          MaterialApp(
            theme: KDTheme.light(),
            home: KDAdaptiveScaffold(
              destinations: _kDestinations,
              selectedIndex: 0,
              onDestinationSelected: selected.add,
              body: const Text('body'),
            ),
          ),
        );
        await tester.tap(find.text('Agents'));
        await tester.pumpAndSettle();

        // Assert
        expect(selected, [1]);
      });
    });
  });

  group('KDLayout', () {
    group('familyForWidth', () {
      testWidgets('should resolve the family from the pane width not the window width', (
        tester,
      ) async {
        // Arrange
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = const Size(1280, 900);
        addTearDown(tester.view.reset);

        // Act
        await tester.pumpWidget(
          MaterialApp(
            theme: KDTheme.light(),
            home: Center(
              child: SizedBox(
                width: 400,
                height: 800,
                child: KDAdaptiveScaffold(
                  destinations: _kDestinations,
                  selectedIndex: 0,
                  onDestinationSelected: (_) {},
                  body: const Text('body'),
                ),
              ),
            ),
          ),
        );

        // Assert
        expect(find.byType(NavigationBar), findsOneWidget);
        expect(find.byType(NavigationRail), findsNothing);
      });
    });
  });
}
