import 'package:flutter/material.dart';

import '../atoms/kd_text.dart';
import '../styles/kd_text_styles.dart';
import '../styles/kd_tokens.dart';

enum KDBrandSize { small, medium, large }

final class KDBrand extends StatelessWidget {
  const KDBrand({this.size = KDBrandSize.medium, this.showWordmark = true, super.key});

  final KDBrandSize size;
  final bool showWordmark;

  // TODO(tokens): a placeholder mark. Replace it when the design file supplies a brand asset.
  static const IconData _kMark = Icons.hub_rounded;
  static const String _kWordmark = 'KanthorD';

  double _markSize(KDTokens tokens) {
    return switch (size) {
      KDBrandSize.small => tokens.spacing.xl,
      KDBrandSize.medium => tokens.spacing.xxl,
      KDBrandSize.large => tokens.spacing.xxxl,
    };
  }

  KDTextRole get _wordmarkRole {
    return switch (size) {
      KDBrandSize.small => KDTextRole.titleSmall,
      KDBrandSize.medium => KDTextRole.titleLarge,
      KDBrandSize.large => KDTextRole.headlineMedium,
    };
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;
    final mark = Icon(
      _kMark,
      size: _markSize(tokens),
      color: Theme.of(context).colorScheme.primary,
      semanticLabel: showWordmark ? null : _kWordmark,
    );

    if (!showWordmark) return mark;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        mark,
        SizedBox(width: tokens.spacing.sm),
        KDText(_kWordmark, role: _wordmarkRole),
      ],
    );
  }
}
