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
final class KDTokens extends ThemeExtension<KDTokens> {
  const KDTokens({
    required this.spacing,
    required this.radius,
    required this.duration,
    required this.elevation,
  });

  const KDTokens.seeded()
    : spacing = const KDSpacing.seeded(),
      radius = const KDRadius.seeded(),
      duration = const KDDuration.seeded(),
      elevation = const KDElevation.seeded();

  final KDSpacing spacing;
  final KDRadius radius;
  final KDDuration duration;
  final KDElevation elevation;

  @override
  KDTokens copyWith({
    KDSpacing? spacing,
    KDRadius? radius,
    KDDuration? duration,
    KDElevation? elevation,
  }) {
    return KDTokens(
      spacing: spacing ?? this.spacing,
      radius: radius ?? this.radius,
      duration: duration ?? this.duration,
      elevation: elevation ?? this.elevation,
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
    );
  }
}

extension KDTokensAccess on BuildContext {
  KDTokens get kdTokens => Theme.of(this).extension<KDTokens>()!;
}
