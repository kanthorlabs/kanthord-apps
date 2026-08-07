import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/libraries/kd_design_system/layout/kd_full_screen_layout.dart';
import 'package:kanthord/libraries/kd_design_system/layout/kd_status_view.dart';
import 'package:kanthord/libraries/kd_design_system/organisms/kd_side_bar.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_theme.dart';

Future<void> _pumpAt(WidgetTester tester, Size size, Widget layout) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(MaterialApp(theme: KDTheme.light(), home: layout));
}

void main() {
  group('KDFullScreenLayout', () {
    group('build', () {
      testWidgets('should render the child when the width is expanded', (tester) async {
        // Arrange
        const layout = KDFullScreenLayout(child: Text('child'));

        // Act
        await _pumpAt(tester, const Size(1280, 900), layout);

        // Assert
        expect(find.text('child'), findsOneWidget);
      });

      testWidgets('should render no navigation in any family', (tester) async {
        // Arrange
        const layout = KDFullScreenLayout(child: Text('child'));

        // Act
        await _pumpAt(tester, const Size(1280, 900), layout);

        // Assert
        expect(find.byType(NavigationBar), findsNothing);
        expect(find.byType(NavigationRail), findsNothing);
        expect(find.byType(KDSideBar), findsNothing);
        expect(find.byType(AppBar), findsNothing);
      });

      testWidgets('should render the brand when showBrand is true', (tester) async {
        // Arrange
        const layout = KDFullScreenLayout(child: Text('child'));

        // Act
        await _pumpAt(tester, const Size(1280, 900), layout);

        // Assert
        expect(find.text('KanthorD'), findsOneWidget);
      });

      testWidgets('should render no brand when showBrand is false', (tester) async {
        // Arrange
        const layout = KDFullScreenLayout(showBrand: false, child: Text('child'));

        // Act
        await _pumpAt(tester, const Size(1280, 900), layout);

        // Assert
        expect(find.text('KanthorD'), findsNothing);
      });

      testWidgets('should render the footer when a footer is given', (tester) async {
        // Arrange
        const layout = KDFullScreenLayout(footer: Text('footer'), child: Text('child'));

        // Act
        await _pumpAt(tester, const Size(1280, 900), layout);

        // Assert
        expect(find.text('footer'), findsOneWidget);
      });

      testWidgets('should throw no exception when the window is shorter than the content', (
        tester,
      ) async {
        // Arrange
        const layout = KDFullScreenLayout(
          child: KDStatusView(
            kind: KDStatusKind.error,
            title: 'The daemon is unreachable',
            message: 'Check the base URL, and check that the daemon runs on that port.',
          ),
        );

        // Act
        await _pumpAt(tester, const Size(400, 300), layout);

        // Assert
        expect(tester.takeException(), isNull);
      });

      testWidgets('should host a status view when the family is mobile', (tester) async {
        // Arrange
        const layout = KDFullScreenLayout(
          showBrand: false,
          child: KDStatusView(kind: KDStatusKind.loading, title: 'Reaching the daemon'),
        );

        // Act
        await _pumpAt(tester, const Size(400, 900), layout);

        // Assert
        expect(find.text('Reaching the daemon'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    });
  });
}
