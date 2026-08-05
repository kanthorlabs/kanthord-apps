import 'package:flutter/material.dart';

import '../styles/kd_text_styles.dart';

enum KDTextTone { primary, secondary, error, onAccent }

final class KDText extends StatelessWidget {
  const KDText(
    this.text, {
    this.role = KDTextRole.bodyMedium,
    this.tone = KDTextTone.primary,
    this.maxLines,
    this.textAlign,
    this.overflow,
    super.key,
  });

  final String text;
  final KDTextRole role;
  final KDTextTone tone;
  final int? maxLines;
  final TextAlign? textAlign;
  final TextOverflow? overflow;

  Color _color(ColorScheme scheme) {
    return switch (tone) {
      KDTextTone.primary => scheme.onSurface,
      KDTextTone.secondary => scheme.onSurfaceVariant,
      KDTextTone.error => scheme.error,
      KDTextTone.onAccent => scheme.onPrimary,
    };
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Text(
      text,
      style: role.resolve(theme.textTheme)?.copyWith(color: _color(theme.colorScheme)),
      maxLines: maxLines,
      textAlign: textAlign,
      overflow: overflow ?? (maxLines != null ? TextOverflow.ellipsis : null),
    );
  }
}
