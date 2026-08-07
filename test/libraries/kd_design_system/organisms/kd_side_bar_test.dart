import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/libraries/kd_design_system/layout/kd_destination.dart';
import 'package:kanthord/libraries/kd_design_system/organisms/kd_side_bar.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_theme.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_tokens.dart';

final KDSizing _kSizing = KDTheme.light().extension<KDTokens>()!.sizing;

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

Future<void> _pump(WidgetTester tester, KDSideBar sideBar) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(1000, 800);
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: KDTheme.light(),
      home: Scaffold(
        body: Row(
          children: [
            sideBar,
            const Expanded(child: Text('content')),
          ],
        ),
      ),
    ),
  );
}

void main() {
  group('KDSideBar', () {
    group('build', () {
      testWidgets('should render every destination when the sections are given', (tester) async {
        // Arrange
        final sideBar = KDSideBar(
          sections: _kSections,
          selectedIndex: 0,
          onDestinationSelected: (_) {},
        );

        // Act
        await _pump(tester, sideBar);

        // Assert
        expect(find.text('Projects'), findsOneWidget);
        expect(find.text('Nodes'), findsOneWidget);
        expect(find.text('Activity'), findsOneWidget);
      });

      testWidgets('should render a section label when the section carries one', (tester) async {
        // Arrange
        final sideBar = KDSideBar(
          sections: _kSections,
          selectedIndex: 0,
          onDestinationSelected: (_) {},
        );

        // Act
        await _pump(tester, sideBar);

        // Assert
        expect(find.text('Plan'), findsOneWidget);
        expect(find.text('System'), findsOneWidget);
      });

      testWidgets('should render no section label when the section carries none', (tester) async {
        // Arrange
        final sideBar = KDSideBar(
          sections: const [
            KDSideBarSection(
              destinations: [
                KDDestination(
                  label: 'Projects',
                  icon: Icons.folder_outlined,
                  selectedIcon: Icons.folder,
                ),
              ],
            ),
          ],
          selectedIndex: 0,
          onDestinationSelected: (_) {},
        );

        // Act
        await _pump(tester, sideBar);

        // Assert
        expect(find.byType(Divider), findsNothing);
        expect(find.text('Projects'), findsOneWidget);
      });

      testWidgets('should render one rule between two sections', (tester) async {
        // Arrange
        final sideBar = KDSideBar(
          sections: _kSections,
          selectedIndex: 0,
          onDestinationSelected: (_) {},
        );

        // Act
        await _pump(tester, sideBar);

        // Assert
        expect(find.byType(Divider), findsOneWidget);
      });

      testWidgets('should render the header and the footer when both are given', (tester) async {
        // Arrange
        final sideBar = KDSideBar(
          sections: _kSections,
          selectedIndex: 0,
          onDestinationSelected: (_) {},
          header: const Text('header'),
          footer: const Text('footer'),
        );

        // Act
        await _pump(tester, sideBar);

        // Assert
        expect(find.text('header'), findsOneWidget);
        expect(find.text('footer'), findsOneWidget);
      });

      testWidgets('should take the width from the width property', (tester) async {
        // Arrange
        final sideBar = KDSideBar(
          sections: _kSections,
          selectedIndex: 0,
          onDestinationSelected: (_) {},
        );

        // Act
        await _pump(tester, sideBar);

        // Assert
        expect(tester.getSize(find.byType(KDSideBar)).width, _kSizing.sideBarWidth);
      });
    });

    group('onDestinationSelected', () {
      testWidgets('should report a flat index that skips the section labels', (tester) async {
        // Arrange
        final selected = <int>[];

        // Act
        await _pump(
          tester,
          KDSideBar(sections: _kSections, selectedIndex: 0, onDestinationSelected: selected.add),
        );
        await tester.tap(find.text('Activity'));
        await tester.pumpAndSettle();

        // Assert
        expect(selected, [2]);
      });

      testWidgets('should report the index of the second destination of the first section', (
        tester,
      ) async {
        // Arrange
        final selected = <int>[];

        // Act
        await _pump(
          tester,
          KDSideBar(sections: _kSections, selectedIndex: 0, onDestinationSelected: selected.add),
        );
        await tester.tap(find.text('Nodes'));
        await tester.pumpAndSettle();

        // Assert
        expect(selected, [1]);
      });
    });
  });
}
