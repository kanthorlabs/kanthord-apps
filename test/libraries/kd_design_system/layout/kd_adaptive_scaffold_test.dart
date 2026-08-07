import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/libraries/kd_design_system/layout/kd_adaptive_scaffold.dart';
import 'package:kanthord/libraries/kd_design_system/layout/kd_destination.dart';
import 'package:kanthord/libraries/kd_design_system/layout/kd_layout.dart';
import 'package:kanthord/libraries/kd_design_system/layout/kd_layout_family.dart';
import 'package:kanthord/libraries/kd_design_system/organisms/kd_side_bar.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_theme.dart';

const List<KDDestination> _kDestinations = [
  KDDestination(
    label: 'Nodes',
    icon: Icons.account_tree_outlined,
    selectedIcon: Icons.account_tree,
  ),
  KDDestination(label: 'Activity', icon: Icons.history_outlined, selectedIcon: Icons.history),
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
        expect(find.byType(KDSideBar), findsNothing);
      });

      testWidgets('should render a navigation rail when the width is 600', (tester) async {
        // Arrange
        const size = Size(600, 900);

        // Act
        await _pumpAt(tester, size);

        // Assert
        expect(find.byType(NavigationRail), findsOneWidget);
        expect(find.byType(NavigationBar), findsNothing);
        expect(find.byType(KDSideBar), findsNothing);
      });

      testWidgets('should render a navigation rail when the width is 839', (tester) async {
        // Arrange
        const size = Size(839, 900);

        // Act
        await _pumpAt(tester, size);

        // Assert
        expect(find.byType(NavigationRail), findsOneWidget);
        expect(find.byType(KDSideBar), findsNothing);
      });

      testWidgets('should render a sidebar when the width is 840', (tester) async {
        // Arrange
        const size = Size(840, 900);

        // Act
        await _pumpAt(tester, size);

        // Assert
        expect(find.byType(KDSideBar), findsOneWidget);
        expect(find.byType(NavigationRail), findsNothing);
        expect(find.byType(NavigationBar), findsNothing);
      });

      testWidgets('should render a sidebar when the width is above 840', (tester) async {
        // Arrange
        const size = Size(1280, 900);

        // Act
        await _pumpAt(tester, size);

        // Assert
        expect(find.byType(KDSideBar), findsOneWidget);
        expect(find.byType(NavigationRail), findsNothing);
      });

      testWidgets('should render the body when the family is mobile', (tester) async {
        // Arrange
        const size = Size(400, 900);

        // Act
        await _pumpAt(tester, size);

        // Assert
        expect(find.text('body'), findsOneWidget);
      });

      testWidgets('should render the body when the family is expanded', (tester) async {
        // Arrange
        const size = Size(1280, 900);

        // Act
        await _pumpAt(tester, size);

        // Assert
        expect(find.text('body'), findsOneWidget);
      });

      testWidgets('should build one section from the destinations when sections is null', (
        tester,
      ) async {
        // Arrange
        const size = Size(1280, 900);

        // Act
        await _pumpAt(tester, size);

        // Assert
        expect(find.text('Nodes'), findsOneWidget);
        expect(find.text('Activity'), findsOneWidget);
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
        await tester.tap(find.text('Activity'));
        await tester.pumpAndSettle();

        // Assert
        expect(selected, [1]);
      });
    });
  });

  group('KDLayout', () {
    group('familyForWidth', () {
      test('should resolve mobile when the width is below 600', () {
        // Arrange
        const width = 599.0;

        // Act
        final family = KDLayout.familyForWidth(width);

        // Assert
        expect(family, KDLayoutFamily.mobile);
      });

      test('should resolve wide when the width is 600', () {
        // Arrange
        const width = 600.0;

        // Act
        final family = KDLayout.familyForWidth(width);

        // Assert
        expect(family, KDLayoutFamily.wide);
      });

      test('should resolve wide when the width is 839', () {
        // Arrange
        const width = 839.0;

        // Act
        final family = KDLayout.familyForWidth(width);

        // Assert
        expect(family, KDLayoutFamily.wide);
      });

      test('should resolve expanded when the width is 840', () {
        // Arrange
        const width = 840.0;

        // Act
        final family = KDLayout.familyForWidth(width);

        // Assert
        expect(family, KDLayoutFamily.expanded);
      });

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
        expect(find.byType(KDSideBar), findsNothing);
      });
    });
  });
}
