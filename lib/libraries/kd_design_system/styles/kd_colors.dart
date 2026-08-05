import 'package:flutter/material.dart';

abstract final class KDColors {
  // TODO(tokens): the Flutter Material 3 baseline seed. Replace with the design file palette.
  static const Color seed = Color(0xFF6750A4);

  static ColorScheme light() {
    return ColorScheme.fromSeed(seedColor: seed, brightness: Brightness.light);
  }

  static ColorScheme dark() {
    return ColorScheme.fromSeed(seedColor: seed, brightness: Brightness.dark);
  }
}
