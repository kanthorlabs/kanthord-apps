import 'package:flutter/material.dart';

import '../atoms/kd_text.dart';
import '../styles/kd_text_styles.dart';
import '../styles/kd_tokens.dart';

final class KDCard extends StatelessWidget {
  const KDCard({
    required this.title,
    this.description,
    this.leading,
    this.trailing,
    this.isEnabled = true,
    this.isHighlighted = false,
    this.onTap,
    this.onLongPress,
    this.onHover,
    super.key,
  });

  final String title;
  final String? description;
  final Widget? leading;
  final Widget? trailing;
  final bool isEnabled;
  final bool isHighlighted;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final ValueChanged<bool>? onHover;

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;
    final scheme = Theme.of(context).colorScheme;

    final content = Padding(
      padding: EdgeInsets.all(tokens.spacing.lg),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (leading != null) ...[leading!, SizedBox(width: tokens.spacing.md)],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                KDText(title, role: KDTextRole.titleMedium),
                if (description != null) ...[
                  SizedBox(height: tokens.spacing.xs),
                  KDText(
                    description!,
                    role: KDTextRole.bodyMedium,
                    tone: KDTextTone.secondary,
                    maxLines: 3,
                  ),
                ],
              ],
            ),
          ),
          if (trailing != null) ...[SizedBox(width: tokens.spacing.md), trailing!],
        ],
      ),
    );

    final card = Card(
      clipBehavior: Clip.antiAlias,
      elevation: isHighlighted ? tokens.elevation.medium : tokens.elevation.low,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(tokens.radius.md),
        side: isHighlighted ? BorderSide(color: scheme.primary, width: 2) : BorderSide.none,
      ),
      child: onTap == null && onLongPress == null
          ? content
          : InkWell(
              onTap: isEnabled ? onTap : null,
              onLongPress: isEnabled ? onLongPress : null,
              onHover: onHover,
              child: content,
            ),
    );

    if (isEnabled) return card;
    return Opacity(opacity: 0.5, child: IgnorePointer(child: card));
  }
}
