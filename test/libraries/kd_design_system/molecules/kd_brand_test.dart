import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/libraries/kd_design_system/molecules/kd_brand.dart';
import 'package:kanthord/libraries/kd_design_system/styles/kd_theme.dart';

Future<void> _pump(WidgetTester tester, KDBrand brand, {ThemeData? theme}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: theme ?? KDTheme.light(),
      home: Scaffold(body: Center(child: brand)),
    ),
  );
}

void main() {
  group('KDBrand', () {
    group('build', () {
      testWidgets('should render the wordmark when showWordmark is true', (tester) async {
        // Arrange
        const brand = KDBrand();

        // Act
        await _pump(tester, brand);

        // Assert
        expect(find.text('KanthorD'), findsOneWidget);
        expect(find.byIcon(Icons.hub_rounded), findsOneWidget);
      });

      testWidgets('should render no wordmark when showWordmark is false', (tester) async {
        // Arrange
        const brand = KDBrand(showWordmark: false);

        // Act
        await _pump(tester, brand);

        // Assert
        expect(find.text('KanthorD'), findsNothing);
        expect(find.byIcon(Icons.hub_rounded), findsOneWidget);
      });

      testWidgets('should carry a semantic label when the wordmark is hidden', (tester) async {
        // Arrange
        const brand = KDBrand(showWordmark: false);

        // Act
        await _pump(tester, brand);

        // Assert
        final icon = tester.widget<Icon>(find.byIcon(Icons.hub_rounded));
        expect(icon.semanticLabel, 'KanthorD');
      });

      testWidgets('should grow the mark when the size is large', (tester) async {
        // Arrange
        const brand = KDBrand(size: KDBrandSize.large);

        // Act
        await _pump(tester, brand);

        // Assert
        final icon = tester.widget<Icon>(find.byIcon(Icons.hub_rounded));
        expect(icon.size, 48);
      });

      testWidgets('should shrink the mark when the size is small', (tester) async {
        // Arrange
        const brand = KDBrand(size: KDBrandSize.small);

        // Act
        await _pump(tester, brand);

        // Assert
        final icon = tester.widget<Icon>(find.byIcon(Icons.hub_rounded));
        expect(icon.size, 24);
      });

      testWidgets('should paint the mark in the primary role of the dark theme', (tester) async {
        // Arrange
        const brand = KDBrand();

        // Act
        await _pump(tester, brand, theme: KDTheme.dark());

        // Assert
        final icon = tester.widget<Icon>(find.byIcon(Icons.hub_rounded));
        expect(icon.color, KDTheme.dark().colorScheme.primary);
      });
    });
  });
}
