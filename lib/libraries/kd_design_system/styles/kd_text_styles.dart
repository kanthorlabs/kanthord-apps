import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

enum KDTextRole {
  displayLarge,
  displayMedium,
  displaySmall,
  headlineLarge,
  headlineMedium,
  headlineSmall,
  titleLarge,
  titleMedium,
  titleSmall,
  bodyLarge,
  bodyMedium,
  bodySmall,
  labelLarge,
  labelMedium,
  labelSmall;

  TextStyle? resolve(TextTheme theme) {
    return switch (this) {
      KDTextRole.displayLarge => theme.displayLarge,
      KDTextRole.displayMedium => theme.displayMedium,
      KDTextRole.displaySmall => theme.displaySmall,
      KDTextRole.headlineLarge => theme.headlineLarge,
      KDTextRole.headlineMedium => theme.headlineMedium,
      KDTextRole.headlineSmall => theme.headlineSmall,
      KDTextRole.titleLarge => theme.titleLarge,
      KDTextRole.titleMedium => theme.titleMedium,
      KDTextRole.titleSmall => theme.titleSmall,
      KDTextRole.bodyLarge => theme.bodyLarge,
      KDTextRole.bodyMedium => theme.bodyMedium,
      KDTextRole.bodySmall => theme.bodySmall,
      KDTextRole.labelLarge => theme.labelLarge,
      KDTextRole.labelMedium => theme.labelMedium,
      KDTextRole.labelSmall => theme.labelSmall,
    };
  }
}

// TODO(tokens): seeded from the Material 3 2021 type scale. Replace with the design file scale.
abstract final class KDTextStyles {
  static TextTheme textTheme(Brightness brightness) {
    final typography = Typography.material2021(platform: defaultTargetPlatform);
    return brightness == Brightness.dark ? typography.white : typography.black;
  }
}
