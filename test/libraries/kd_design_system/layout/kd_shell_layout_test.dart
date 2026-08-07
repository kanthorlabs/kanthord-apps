import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/libraries/kd_design_system/layout/kd_destination.dart';
import 'package:kanthord/libraries/kd_design_system/layout/kd_shell_layout.dart';
import 'package:kanthord/libraries/kd_design_system/organisms/kd_side_bar.dart';
import 'package:kanthord/libraries/kd_design_system/organisms/kd_top_bar.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_theme.dart';

const List<KDSideBarSection> _kSections = [
  KDSideBarSection(
    label: 'Plan',
    destinations: [
      KDDestination(label: 'Projects', icon: Icons.folder_outlined, selectedIcon: Icons.folder),
      KDDestination(
        label: 'Nodes',
        icon: Icons.account_tree_outlined,
        selectedIcon: Icons.account_tree,
      ),
    ],
  ),
  KDSideBarSection(
    label: 'System',
    destinations: [
      KDDestination(label: 'Activity', icon: Icons.history_outlined, selectedIcon: Icons.history),
    ],
  ),
];

Future<void> _pumpAt(
  WidgetTester tester,
  Size size, {
  ValueChanged<int>? onDestinationSelected,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: KDTheme.light(),
      home: KDShellLayout(
        title: 'Nodes',
        status: KDConnectionStatus.connected,
        sections: _kSections,
        selectedIndex: 1,
        onDestinationSelected: onDestinationSelected ?? (_) {},
        content: const Text('content'),
      ),
    ),
  );
}

void main() {
  group('KDShellLayout', () {
    group('build', () {
      testWidgets('should render bottom navigation when the width is below 600', (tester) async {
        // Arrange
        const size = Size(599, 900);

        // Act
        await _pumpAt(tester, size);

        // Assert
        expect(find.byType(NavigationBar), findsOneWidget);
        expect(find.byType(KDSideBar), findsNothing);
      });

      testWidgets('should render a navigation rail when the width is 700', (tester) async {
        // Arrange
        const size = Size(700, 900);

        // Act
        await _pumpAt(tester, size);

        // Assert
        expect(find.byType(NavigationRail), findsOneWidget);
        expect(find.byType(KDSideBar), findsNothing);
      });

      testWidgets('should render a sidebar when the width is 900', (tester) async {
        // Arrange
        const size = Size(900, 900);

        // Act
        await _pumpAt(tester, size);

        // Assert
        expect(find.byType(KDSideBar), findsOneWidget);
        expect(find.byType(NavigationRail), findsNothing);
      });

      testWidgets('should render the top bar in every family', (tester) async {
        // Arrange
        const size = Size(599, 900);

        // Act
        await _pumpAt(tester, size);

        // Assert
        expect(find.byType(KDTopBar), findsOneWidget);
      });

      testWidgets('should render the content region when the family is expanded', (tester) async {
        // Arrange
        const size = Size(1280, 900);

        // Act
        await _pumpAt(tester, size);

        // Assert
        expect(find.text('content'), findsOneWidget);
      });

      testWidgets('should render the section labels when the family is expanded', (tester) async {
        // Arrange
        const size = Size(1280, 900);

        // Act
        await _pumpAt(tester, size);

        // Assert
        expect(find.text('Plan'), findsOneWidget);
        expect(find.text('System'), findsOneWidget);
      });

      testWidgets('should render no section label when the family is wide', (tester) async {
        // Arrange
        const size = Size(700, 900);

        // Act
        await _pumpAt(tester, size);

        // Assert
        expect(find.text('Plan'), findsNothing);
        expect(find.text('System'), findsNothing);
      });

      testWidgets('should flatten every section into the rail when the family is wide', (
        tester,
      ) async {
        // Arrange
        const size = Size(700, 900);

        // Act
        await _pumpAt(tester, size);

        // Assert
        expect(find.text('Projects'), findsOneWidget);
        expect(find.text('Nodes'), findsWidgets);
        expect(find.text('Activity'), findsOneWidget);
      });
    });

    group('onDestinationSelected', () {
      testWidgets('should report a flat index across sections when the family is expanded', (
        tester,
      ) async {
        // Arrange
        final selected = <int>[];

        // Act
        await _pumpAt(tester, const Size(1280, 900), onDestinationSelected: selected.add);
        await tester.tap(find.text('Activity'));
        await tester.pumpAndSettle();

        // Assert
        expect(selected, [2]);
      });

      testWidgets('should report the same index for the same destination when the family is wide', (
        tester,
      ) async {
        // Arrange
        final selected = <int>[];

        // Act
        await _pumpAt(tester, const Size(700, 900), onDestinationSelected: selected.add);
        await tester.tap(find.text('Activity'));
        await tester.pumpAndSettle();

        // Assert
        expect(selected, [2]);
      });
    });
  });
}
