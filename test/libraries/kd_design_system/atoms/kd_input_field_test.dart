import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/libraries/kd_design_system/atoms/kd_input_field.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_theme.dart';

Future<void> _pump(WidgetTester tester, KDInputField field) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: KDTheme.light(),
      home: Scaffold(body: Center(child: field)),
    ),
  );
}

void main() {
  group('KDInputField', () {
    group('build', () {
      testWidgets('should render the label, the hint and the helper', (tester) async {
        // Arrange
        const field = KDInputField(
          label: 'Base URL',
          hint: 'http://127.0.0.1:8080',
          helper: 'The daemon has no default port.',
        );

        // Act
        await _pump(tester, field);

        // Assert
        expect(find.text('Base URL'), findsOneWidget);
        expect(find.text('http://127.0.0.1:8080'), findsOneWidget);
        expect(find.text('The daemon has no default port.'), findsOneWidget);
      });

      testWidgets('should render the error instead of the helper when error is set', (
        tester,
      ) async {
        // Arrange
        const field = KDInputField(
          label: 'Base URL',
          helper: 'The daemon has no default port.',
          error: 'The URL needs a scheme.',
        );

        // Act
        await _pump(tester, field);

        // Assert
        expect(find.text('The URL needs a scheme.'), findsOneWidget);
        expect(find.text('The daemon has no default port.'), findsNothing);
      });

      testWidgets('should render the initial value when initialValue is set', (tester) async {
        // Arrange
        const field = KDInputField(label: 'Token', initialValue: 'kd_a1b2c3');

        // Act
        await _pump(tester, field);

        // Assert
        expect(find.text('kd_a1b2c3'), findsOneWidget);
      });

      testWidgets('should render no reveal control when isObscured is false', (tester) async {
        // Arrange
        const field = KDInputField(label: 'Base URL');

        // Act
        await _pump(tester, field);

        // Assert
        expect(find.byIcon(Icons.visibility_outlined), findsNothing);
      });

      testWidgets('should obscure the text when isObscured is true', (tester) async {
        // Arrange
        const field = KDInputField(label: 'Token', isObscured: true);

        // Act
        await _pump(tester, field);

        // Assert
        expect(tester.widget<TextField>(find.byType(TextField)).obscureText, isTrue);
        expect(find.byIcon(Icons.visibility_outlined), findsOneWidget);
      });

      testWidgets('should take no input when isEnabled is false', (tester) async {
        // Arrange
        const field = KDInputField(label: 'Token', isEnabled: false);

        // Act
        await _pump(tester, field);

        // Assert
        expect(tester.widget<TextField>(find.byType(TextField)).enabled, isFalse);
      });

      testWidgets('should pass isEnabled through to the reveal control', (tester) async {
        // Arrange
        const field = KDInputField(label: 'Token', isObscured: true, isEnabled: false);

        // Act
        await _pump(tester, field);

        // Assert
        expect(tester.widget<IconButton>(find.byType(IconButton)).onPressed, isNull);
      });
    });

    group('the reveal control', () {
      testWidgets('should show the text when it is pressed', (tester) async {
        // Arrange
        const field = KDInputField(label: 'Token', isObscured: true, initialValue: 'kd_a1b2c3');

        // Act
        await _pump(tester, field);
        await tester.tap(find.byIcon(Icons.visibility_outlined));
        await tester.pumpAndSettle();

        // Assert
        expect(tester.widget<TextField>(find.byType(TextField)).obscureText, isFalse);
        expect(find.byIcon(Icons.visibility_off_outlined), findsOneWidget);
      });

      testWidgets('should hide the text when it is pressed twice', (tester) async {
        // Arrange
        const field = KDInputField(label: 'Token', isObscured: true, initialValue: 'kd_a1b2c3');

        // Act
        await _pump(tester, field);
        await tester.tap(find.byIcon(Icons.visibility_outlined));
        await tester.pumpAndSettle();
        await tester.tap(find.byIcon(Icons.visibility_off_outlined));
        await tester.pumpAndSettle();

        // Assert
        expect(tester.widget<TextField>(find.byType(TextField)).obscureText, isTrue);
      });
    });

    group('onChanged', () {
      testWidgets('should report every keystroke when the field is typed into', (tester) async {
        // Arrange
        final changes = <String>[];

        // Act
        await _pump(tester, KDInputField(label: 'Base URL', onChanged: changes.add));
        await tester.enterText(find.byType(TextField), 'http://127.0.0.1:8080');
        await tester.pumpAndSettle();

        // Assert
        expect(changes, ['http://127.0.0.1:8080']);
      });

      testWidgets('should write into the controller when a controller is given', (tester) async {
        // Arrange
        final controller = TextEditingController();
        addTearDown(controller.dispose);

        // Act
        await _pump(tester, KDInputField(label: 'Base URL', controller: controller));
        await tester.enterText(find.byType(TextField), 'http://127.0.0.1:8080');
        await tester.pumpAndSettle();

        // Assert
        expect(controller.text, 'http://127.0.0.1:8080');
      });
    });
  });
}
