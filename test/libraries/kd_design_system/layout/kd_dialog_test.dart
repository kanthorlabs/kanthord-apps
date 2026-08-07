import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/libraries/kd_design_system/layout/kd_dialog.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_theme.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_tokens.dart';

final KDSizing _kSizing = KDTheme.light().extension<KDTokens>()!.sizing;

Future<void> _pumpAt(WidgetTester tester, Size size, KDDialog dialog) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(MaterialApp(theme: KDTheme.light(), home: dialog));
}

void main() {
  group('KDDialog', () {
    group('build', () {
      testWidgets('should render a full screen when the width is below 600', (tester) async {
        // Arrange
        const dialog = KDDialog(title: 'Approve this node?', child: Text('body'));

        // Act
        await _pumpAt(tester, const Size(599, 900), dialog);

        // Assert
        expect(find.byType(AppBar), findsOneWidget);
        expect(find.byType(Dialog), findsNothing);
      });

      testWidgets('should render a dialog when the width is 600', (tester) async {
        // Arrange
        const dialog = KDDialog(title: 'Approve this node?', child: Text('body'));

        // Act
        await _pumpAt(tester, const Size(600, 900), dialog);

        // Assert
        expect(find.byType(Dialog), findsOneWidget);
        expect(find.byType(AppBar), findsNothing);
      });

      testWidgets('should render the title and the body in both forms', (tester) async {
        // Arrange
        const dialog = KDDialog(title: 'Approve this node?', child: Text('body'));

        // Act
        await _pumpAt(tester, const Size(1200, 900), dialog);

        // Assert
        expect(find.text('Approve this node?'), findsOneWidget);
        expect(find.text('body'), findsOneWidget);
      });

      testWidgets('should render the actions when actions is not empty', (tester) async {
        // Arrange
        final dialog = KDDialog(
          title: 'Approve this node?',
          actions: [FilledButton(onPressed: () {}, child: const Text('Approve'))],
          child: const Text('body'),
        );

        // Act
        await _pumpAt(tester, const Size(1200, 900), dialog);

        // Assert
        expect(find.text('Approve'), findsOneWidget);
      });

      testWidgets('should render no close control when onClose is null', (tester) async {
        // Arrange
        const dialog = KDDialog(title: 'Approve this node?', child: Text('body'));

        // Act
        await _pumpAt(tester, const Size(1200, 900), dialog);

        // Assert
        expect(find.byIcon(Icons.close), findsNothing);
      });

      testWidgets('should cap the width at the content measure when the size is standard', (
        tester,
      ) async {
        // Arrange
        const dialog = KDDialog(title: 'Approve this node?', child: Text('body'));

        // Act
        await _pumpAt(tester, const Size(1200, 900), dialog);

        // Assert
        expect(tester.getSize(find.byType(Divider).first).width, _kSizing.contentMaxWidth);
      });

      testWidgets('should cap the width at the large measure when the size is large', (
        tester,
      ) async {
        // Arrange
        const dialog = KDDialog(
          title: 'sha256:4f2a',
          size: KDDialogSize.large,
          child: Text('body'),
        );

        // Act
        await _pumpAt(tester, const Size(1200, 900), dialog);

        // Assert
        expect(tester.getSize(find.byType(Divider).first).width, _kSizing.dialogLargeWidth);
      });
    });

    group('onClose', () {
      testWidgets('should fire when the close control is tapped in the dialog form', (
        tester,
      ) async {
        // Arrange
        var closed = 0;

        // Act
        await _pumpAt(
          tester,
          const Size(1200, 900),
          KDDialog(title: 'Approve this node?', onClose: () => closed++, child: const Text('body')),
        );
        await tester.tap(find.byIcon(Icons.close));
        await tester.pumpAndSettle();

        // Assert
        expect(closed, 1);
      });

      testWidgets('should fire when the close control is tapped in the full screen form', (
        tester,
      ) async {
        // Arrange
        var closed = 0;

        // Act
        await _pumpAt(
          tester,
          const Size(599, 900),
          KDDialog(title: 'Approve this node?', onClose: () => closed++, child: const Text('body')),
        );
        await tester.tap(find.byIcon(Icons.close));
        await tester.pumpAndSettle();

        // Assert
        expect(closed, 1);
      });
    });

    group('show', () {
      testWidgets('should complete with the popped value when an action pops', (tester) async {
        // Arrange
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = const Size(1200, 900);
        addTearDown(tester.view.reset);
        bool? result;

        // Act
        await tester.pumpWidget(
          MaterialApp(
            theme: KDTheme.light(),
            home: Scaffold(
              body: Builder(
                builder: (context) => TextButton(
                  onPressed: () async {
                    result = await KDDialog.show<bool>(
                      context,
                      builder: (context) => KDDialog(
                        title: 'Approve this node?',
                        actions: [
                          FilledButton(
                            onPressed: () => Navigator.of(context).pop(true),
                            child: const Text('Approve'),
                          ),
                        ],
                        child: const Text('body'),
                      ),
                    );
                  },
                  child: const Text('open'),
                ),
              ),
            ),
          ),
        );
        await tester.tap(find.text('open'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Approve'));
        await tester.pumpAndSettle();

        // Assert
        expect(result, isTrue);
      });

      testWidgets('should render the dialog above the page when it opens', (tester) async {
        // Arrange
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = const Size(1200, 900);
        addTearDown(tester.view.reset);

        // Act
        await tester.pumpWidget(
          MaterialApp(
            theme: KDTheme.light(),
            home: Scaffold(
              body: Builder(
                builder: (context) => TextButton(
                  onPressed: () => KDDialog.show<void>(
                    context,
                    builder: (context) =>
                        const KDDialog(title: 'Approve this node?', child: Text('body')),
                  ),
                  child: const Text('open'),
                ),
              ),
            ),
          ),
        );
        await tester.tap(find.text('open'));
        await tester.pumpAndSettle();

        // Assert
        expect(find.byType(Dialog), findsOneWidget);
        expect(find.text('open'), findsOneWidget);
      });
    });
  });
}
