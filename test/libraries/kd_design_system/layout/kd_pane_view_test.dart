import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/libraries/kd_design_system/layout/kd_pane_view.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_theme.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_tokens.dart';

final KDSizing _kSizing = KDTheme.light().extension<KDTokens>()!.sizing;

Future<void> _pumpAt(WidgetTester tester, Size size, KDPaneView paneView) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: KDTheme.light(),
      home: Scaffold(body: paneView),
    ),
  );
}

void main() {
  group('KDPaneView', () {
    group('build', () {
      testWidgets('should render the list only when the width is below 600', (tester) async {
        // Arrange
        const paneView = KDPaneView(list: Text('list'), detail: Text('detail'));

        // Act
        await _pumpAt(tester, const Size(599, 900), paneView);

        // Assert
        expect(find.text('detail'), findsOneWidget);
        expect(find.text('list'), findsNothing);
        expect(find.byType(VerticalDivider), findsNothing);
      });

      testWidgets('should render the list when the detail is null below 600', (tester) async {
        // Arrange
        const paneView = KDPaneView(list: Text('list'));

        // Act
        await _pumpAt(tester, const Size(599, 900), paneView);

        // Assert
        expect(find.text('list'), findsOneWidget);
      });

      testWidgets('should render both panes when the width is 600', (tester) async {
        // Arrange
        const paneView = KDPaneView(list: Text('list'), detail: Text('detail'));

        // Act
        await _pumpAt(tester, const Size(600, 900), paneView);

        // Assert
        expect(find.text('list'), findsOneWidget);
        expect(find.text('detail'), findsOneWidget);
        expect(find.byType(VerticalDivider), findsOneWidget);
      });

      testWidgets('should render the placeholder when the detail is null in the split', (
        tester,
      ) async {
        // Arrange
        const paneView = KDPaneView(list: Text('list'), placeholder: Text('placeholder'));

        // Act
        await _pumpAt(tester, const Size(1000, 900), paneView);

        // Assert
        expect(find.text('list'), findsOneWidget);
        expect(find.text('placeholder'), findsOneWidget);
      });

      testWidgets('should render no placeholder when the detail is set in the split', (
        tester,
      ) async {
        // Arrange
        const paneView = KDPaneView(
          list: Text('list'),
          detail: Text('detail'),
          placeholder: Text('placeholder'),
        );

        // Act
        await _pumpAt(tester, const Size(1000, 900), paneView);

        // Assert
        expect(find.text('detail'), findsOneWidget);
        expect(find.text('placeholder'), findsNothing);
      });

      testWidgets('should give the list pane the listWidth in the split', (tester) async {
        // Arrange
        const paneView = KDPaneView(list: Text('list'), detail: Text('detail'));

        // Act
        await _pumpAt(tester, const Size(1000, 900), paneView);

        // Assert
        final listPane = find.ancestor(of: find.text('list'), matching: find.byType(SizedBox));
        expect(tester.getSize(listPane.first).width, _kSizing.paneListWidth);
      });

      testWidgets('should render no back control when onDetailClosed is null', (tester) async {
        // Arrange
        const paneView = KDPaneView(list: Text('list'), detail: Text('detail'));

        // Act
        await _pumpAt(tester, const Size(599, 900), paneView);

        // Assert
        expect(find.byIcon(Icons.arrow_back), findsNothing);
      });

      testWidgets('should render a back control when onDetailClosed is set below 600', (
        tester,
      ) async {
        // Arrange
        final paneView = KDPaneView(
          list: const Text('list'),
          detail: const Text('detail'),
          onDetailClosed: () {},
        );

        // Act
        await _pumpAt(tester, const Size(599, 900), paneView);

        // Assert
        expect(find.byIcon(Icons.arrow_back), findsOneWidget);
      });

      testWidgets('should render no back control in the split', (tester) async {
        // Arrange
        final paneView = KDPaneView(
          list: const Text('list'),
          detail: const Text('detail'),
          onDetailClosed: () {},
        );

        // Act
        await _pumpAt(tester, const Size(1000, 900), paneView);

        // Assert
        expect(find.byIcon(Icons.arrow_back), findsNothing);
      });

      testWidgets('should resolve the split from the pane width not the window width', (
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
            home: const Scaffold(
              body: Center(
                child: SizedBox(
                  width: 400,
                  height: 800,
                  child: KDPaneView(list: Text('list'), detail: Text('detail')),
                ),
              ),
            ),
          ),
        );

        // Assert
        expect(find.byType(VerticalDivider), findsNothing);
        expect(find.text('list'), findsNothing);
      });
    });

    group('onDetailClosed', () {
      testWidgets('should fire when the back control is tapped', (tester) async {
        // Arrange
        var closed = 0;

        // Act
        await _pumpAt(
          tester,
          const Size(599, 900),
          KDPaneView(
            list: const Text('list'),
            detail: const Text('detail'),
            onDetailClosed: () => closed++,
          ),
        );
        await tester.tap(find.byIcon(Icons.arrow_back));
        await tester.pumpAndSettle();

        // Assert
        expect(closed, 1);
      });
    });
  });
}
