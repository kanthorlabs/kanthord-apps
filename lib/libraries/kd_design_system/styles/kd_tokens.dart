import 'dart:ui';

import 'package:flutter/material.dart';

@immutable
final class KDSpacing {
  const KDSpacing({
    required this.xs,
    required this.sm,
    required this.md,
    required this.lg,
    required this.xl,
    required this.xxl,
    required this.xxxl,
  });

  // TODO(tokens): seeded from a 4-point scale. Replace with the design file scale.
  const KDSpacing.seeded() : xs = 4, sm = 8, md = 12, lg = 16, xl = 24, xxl = 32, xxxl = 48;

  final double xs;
  final double sm;
  final double md;
  final double lg;
  final double xl;
  final double xxl;
  final double xxxl;

  KDSpacing lerpTo(KDSpacing other, double t) {
    return KDSpacing(
      xs: lerpDouble(xs, other.xs, t)!,
      sm: lerpDouble(sm, other.sm, t)!,
      md: lerpDouble(md, other.md, t)!,
      lg: lerpDouble(lg, other.lg, t)!,
      xl: lerpDouble(xl, other.xl, t)!,
      xxl: lerpDouble(xxl, other.xxl, t)!,
      xxxl: lerpDouble(xxxl, other.xxxl, t)!,
    );
  }
}

@immutable
final class KDRadius {
  const KDRadius({
    required this.xs,
    required this.sm,
    required this.md,
    required this.lg,
    required this.full,
  });

  // TODO(tokens): seeded from the Material 3 shape scale. Replace with the design file scale.
  const KDRadius.seeded() : xs = 4, sm = 8, md = 12, lg = 16, full = 9999;

  final double xs;
  final double sm;
  final double md;
  final double lg;
  final double full;

  KDRadius lerpTo(KDRadius other, double t) {
    return KDRadius(
      xs: lerpDouble(xs, other.xs, t)!,
      sm: lerpDouble(sm, other.sm, t)!,
      md: lerpDouble(md, other.md, t)!,
      lg: lerpDouble(lg, other.lg, t)!,
      full: lerpDouble(full, other.full, t)!,
    );
  }
}

@immutable
final class KDDuration {
  const KDDuration({required this.fast, required this.normal, required this.slow});

  // TODO(tokens): seeded from the Material 3 motion scale. Replace with the design file scale.
  const KDDuration.seeded()
    : fast = const Duration(milliseconds: 100),
      normal = const Duration(milliseconds: 200),
      slow = const Duration(milliseconds: 400);

  final Duration fast;
  final Duration normal;
  final Duration slow;
}

@immutable
final class KDElevation {
  const KDElevation({
    required this.none,
    required this.low,
    required this.medium,
    required this.high,
  });

  // TODO(tokens): seeded from the Material 3 elevation scale. Replace with the design file scale.
  const KDElevation.seeded() : none = 0, low = 1, medium = 3, high = 6;

  final double none;
  final double low;
  final double medium;
  final double high;

  KDElevation lerpTo(KDElevation other, double t) {
    return KDElevation(
      none: lerpDouble(none, other.none, t)!,
      low: lerpDouble(low, other.low, t)!,
      medium: lerpDouble(medium, other.medium, t)!,
      high: lerpDouble(high, other.high, t)!,
    );
  }
}

@immutable
final class KDSizing {
  const KDSizing({
    required this.contentMaxWidth,
    required this.sideBarWidth,
    required this.paneListWidth,
    required this.dialogLargeWidth,
  });

  // TODO(tokens): seeded measures. Replace them with the design file layout scale.
  const KDSizing.seeded()
    : contentMaxWidth = 480,
      sideBarWidth = 280,
      paneListWidth = 320,
      dialogLargeWidth = 800;

  final double contentMaxWidth;
  final double sideBarWidth;
  final double paneListWidth;
  final double dialogLargeWidth;

  KDSizing lerpTo(KDSizing other, double t) {
    return KDSizing(
      contentMaxWidth: lerpDouble(contentMaxWidth, other.contentMaxWidth, t)!,
      sideBarWidth: lerpDouble(sideBarWidth, other.sideBarWidth, t)!,
      paneListWidth: lerpDouble(paneListWidth, other.paneListWidth, t)!,
      dialogLargeWidth: lerpDouble(dialogLargeWidth, other.dialogLargeWidth, t)!,
    );
  }
}

@immutable
final class KDStatusColors {
  const KDStatusColors({
    required this.healthy,
    required this.warning,
    required this.danger,
    required this.neutral,
  });

  // TODO(tokens): Material 3 defines no success role and no warning role, so primary and tertiary
  // stand in. Replace them with the design file status palette.
  KDStatusColors.seeded(ColorScheme scheme)
    : healthy = scheme.primary,
      warning = scheme.tertiary,
      danger = scheme.error,
      neutral = scheme.onSurfaceVariant;

  final Color healthy;
  final Color warning;
  final Color danger;
  final Color neutral;

  KDStatusColors lerpTo(KDStatusColors other, double t) {
    return KDStatusColors(
      healthy: Color.lerp(healthy, other.healthy, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      neutral: Color.lerp(neutral, other.neutral, t)!,
    );
  }
}

@immutable
final class KDTokens extends ThemeExtension<KDTokens> {
  const KDTokens({
    required this.spacing,
    required this.radius,
    required this.duration,
    required this.elevation,
    required this.sizing,
    required this.statusColors,
  });

  KDTokens.seeded(ColorScheme scheme)
    : spacing = const KDSpacing.seeded(),
      radius = const KDRadius.seeded(),
      duration = const KDDuration.seeded(),
      elevation = const KDElevation.seeded(),
      sizing = const KDSizing.seeded(),
      statusColors = KDStatusColors.seeded(scheme);

  final KDSpacing spacing;
  final KDRadius radius;
  final KDDuration duration;
  final KDElevation elevation;
  final KDSizing sizing;
  final KDStatusColors statusColors;

  @override
  KDTokens copyWith({
    KDSpacing? spacing,
    KDRadius? radius,
    KDDuration? duration,
    KDElevation? elevation,
    KDSizing? sizing,
    KDStatusColors? statusColors,
  }) {
    return KDTokens(
      spacing: spacing ?? this.spacing,
      radius: radius ?? this.radius,
      duration: duration ?? this.duration,
      elevation: elevation ?? this.elevation,
      sizing: sizing ?? this.sizing,
      statusColors: statusColors ?? this.statusColors,
    );
  }

  @override
  KDTokens lerp(covariant KDTokens? other, double t) {
    if (other == null) return this;
    return KDTokens(
      spacing: spacing.lerpTo(other.spacing, t),
      radius: radius.lerpTo(other.radius, t),
      duration: t < 0.5 ? duration : other.duration,
      elevation: elevation.lerpTo(other.elevation, t),
      sizing: sizing.lerpTo(other.sizing, t),
      statusColors: statusColors.lerpTo(other.statusColors, t),
    );
  }
}

extension KDTokensAccess on BuildContext {
  KDTokens get kdTokens => Theme.of(this).extension<KDTokens>()!;
}
