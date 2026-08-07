import 'package:flutter/material.dart';

import '../atoms/kd_text.dart';
import '../styles/kd_text_styles.dart';
import '../styles/kd_tokens.dart';

enum KDStatusKind { loading, error, empty, notImplemented }

final class KDStatusView extends StatelessWidget {
  const KDStatusView({
    required this.kind,
    required this.title,
    this.message,
    this.actions = const <Widget>[],
    super.key,
  });

  final KDStatusKind kind;
  final String title;
  final String? message;
  final List<Widget> actions;

  Widget _buildGlyph(BuildContext context, Color color) {
    final icon = switch (kind) {
      KDStatusKind.loading => null,
      KDStatusKind.error => Icons.error_outline,
      KDStatusKind.empty => Icons.inbox_outlined,
      KDStatusKind.notImplemented => Icons.construction_outlined,
    };
    if (icon == null) return CircularProgressIndicator(color: color);
    return Icon(icon, size: context.kdTokens.spacing.xxxl, color: color);
  }

  Color _color(ColorScheme scheme, KDStatusColors statusColors) {
    return switch (kind) {
      KDStatusKind.loading => scheme.primary,
      KDStatusKind.error => statusColors.danger,
      KDStatusKind.empty => statusColors.neutral,
      KDStatusKind.notImplemented => statusColors.neutral,
    };
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;
    final color = _color(Theme.of(context).colorScheme, tokens.statusColors);

    return Center(
      child: SingleChildScrollView(
        padding: EdgeInsets.all(tokens.spacing.xl),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: tokens.sizing.contentMaxWidth),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildGlyph(context, color),
              SizedBox(height: tokens.spacing.xl),
              KDText(title, role: KDTextRole.titleLarge, textAlign: TextAlign.center),
              if (message != null) ...[
                SizedBox(height: tokens.spacing.sm),
                KDText(
                  message!,
                  role: KDTextRole.bodyMedium,
                  tone: kind == KDStatusKind.error ? KDTextTone.error : KDTextTone.secondary,
                  textAlign: TextAlign.center,
                ),
              ],
              if (actions.isNotEmpty) ...[
                SizedBox(height: tokens.spacing.xl),
                Wrap(
                  spacing: tokens.spacing.sm,
                  runSpacing: tokens.spacing.sm,
                  alignment: WrapAlignment.center,
                  children: actions,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
