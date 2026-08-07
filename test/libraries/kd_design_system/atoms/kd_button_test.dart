import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/libraries/kd_design_system/atoms/kd_button.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_theme.dart';

Future<void> _pump(WidgetTester tester, KDButton button) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: KDTheme.light(),
      home: Scaffold(body: Center(child: button)),
    ),
  );
}

void main() {
  group('KDButton', () {
    group('build', () {
      testWidgets('should render a filled button when the variant is primary', (tester) async {
        // Arrange
        final button = KDButton(label: 'Connect', onPressed: () {});

        // Act
        await _pump(tester, button);

        // Assert
        expect(find.byType(FilledButton), findsOneWidget);
        expect(find.text('Connect'), findsOneWidget);
      });

      testWidgets('should render an outlined button when the variant is secondary', (tester) async {
        // Arrange
        final button = KDButton(
          label: 'Cancel',
          variant: KDButtonVariant.secondary,
          onPressed: () {},
        );

        // Act
        await _pump(tester, button);

        // Assert
        expect(find.byType(OutlinedButton), findsOneWidget);
      });

      testWidgets('should render a text button when the variant is text', (tester) async {
        // Arrange
        final button = KDButton(label: 'Skip', variant: KDButtonVariant.text, onPressed: () {});

        // Act
        await _pump(tester, button);

        // Assert
        expect(find.byType(TextButton), findsOneWidget);
      });

      testWidgets('should render the icon when an icon is given', (tester) async {
        // Arrange
        final button = KDButton(label: 'Connect', icon: Icons.link, onPressed: () {});

        // Act
        await _pump(tester, button);

        // Assert
        expect(find.byIcon(Icons.link), findsOneWidget);
      });

      testWidgets('should render a progress indicator when isBusy is true', (tester) async {
        // Arrange
        final button = KDButton(label: 'Connect', isBusy: true, onPressed: () {});

        // Act
        await _pump(tester, button);

        // Assert
        expect(find.byType(CircularProgressIndicator), findsOneWidget);
        expect(find.text('Connect'), findsOneWidget);
      });

      testWidgets('should render an icon button when the icon constructor is used', (tester) async {
        // Arrange
        final button = KDButton.icon(
          icon: Icons.settings_outlined,
          tooltip: 'Open the settings',
          onPressed: () {},
        );

        // Act
        await _pump(tester, button);

        // Assert
        expect(find.byType(IconButton), findsOneWidget);
        expect(find.byTooltip('Open the settings'), findsOneWidget);
      });
    });

    group('onPressed', () {
      testWidgets('should fire when the button is enabled', (tester) async {
        // Arrange
        var pressed = 0;

        // Act
        await _pump(tester, KDButton(label: 'Connect', onPressed: () => pressed++));
        await tester.tap(find.byType(FilledButton));
        await tester.pumpAndSettle();

        // Assert
        expect(pressed, 1);
      });

      testWidgets('should fire nothing when isEnabled is false', (tester) async {
        // Arrange
        var pressed = 0;

        // Act
        await _pump(
          tester,
          KDButton(label: 'Connect', isEnabled: false, onPressed: () => pressed++),
        );
        await tester.tap(find.byType(FilledButton));
        await tester.pumpAndSettle();

        // Assert
        expect(pressed, 0);
      });

      testWidgets('should fire nothing when isBusy is true', (tester) async {
        // Arrange
        var pressed = 0;

        // Act
        await _pump(tester, KDButton(label: 'Connect', isBusy: true, onPressed: () => pressed++));
        await tester.tap(find.byType(FilledButton));
        await tester.pump();

        // Assert
        expect(pressed, 0);
      });
    });
  });
}
