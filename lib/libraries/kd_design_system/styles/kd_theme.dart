import 'package:flutter/material.dart';

import 'kd_colors.dart';
import 'kd_text_styles.dart';
import 'kd_tokens.dart';

abstract final class KDTheme {
  static ThemeData light() => _build(KDColors.light());

  static ThemeData dark() => _build(KDColors.dark());

  static ThemeData _build(ColorScheme scheme) {
    const tokens = KDTokens.seeded();
    return ThemeData(
      colorScheme: scheme,
      textTheme: KDTextStyles.textTheme(scheme.brightness),
      extensions: const <ThemeExtension<dynamic>>[tokens],
      cardTheme: CardThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(tokens.radius.md)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(tokens.radius.full)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(tokens.radius.sm)),
      ),
    );
  }
}
