import 'package:flutter/material.dart';

import '../styles/kd_tokens.dart';

enum KDButtonVariant { primary, secondary, text }

final class KDButton extends StatelessWidget {
  const KDButton({
    required this.label,
    this.icon,
    this.variant = KDButtonVariant.primary,
    this.isEnabled = true,
    this.isBusy = false,
    this.onPressed,
    this.tooltip,
    super.key,
  }) : _isIconOnly = false;

  const KDButton.icon({
    required IconData this.icon,
    required String this.tooltip,
    this.variant = KDButtonVariant.text,
    this.isEnabled = true,
    this.isBusy = false,
    this.onPressed,
    super.key,
  }) : label = '',
       _isIconOnly = true;

  final String label;
  final IconData? icon;
  final KDButtonVariant variant;
  final bool isEnabled;
  final bool isBusy;
  final VoidCallback? onPressed;
  final String? tooltip;

  final bool _isIconOnly;

  Widget _buildBusyIndicator(BuildContext context) {
    final size = IconTheme.of(context).size ?? context.kdTokens.spacing.xl;
    return SizedBox(
      width: size,
      height: size,
      child: const CircularProgressIndicator(strokeWidth: 2),
    );
  }

  Widget _buildIconOnly(BuildContext context, VoidCallback? onPressed) {
    final child = isBusy ? _buildBusyIndicator(context) : Icon(icon);
    return switch (variant) {
      KDButtonVariant.primary => IconButton.filled(
        onPressed: onPressed,
        tooltip: tooltip,
        icon: child,
      ),
      KDButtonVariant.secondary => IconButton.outlined(
        onPressed: onPressed,
        tooltip: tooltip,
        icon: child,
      ),
      KDButtonVariant.text => IconButton(onPressed: onPressed, tooltip: tooltip, icon: child),
    };
  }

  Widget _buildLabelled(BuildContext context, VoidCallback? onPressed) {
    final text = Text(label);
    if (icon == null && !isBusy) {
      return switch (variant) {
        KDButtonVariant.primary => FilledButton(onPressed: onPressed, child: text),
        KDButtonVariant.secondary => OutlinedButton(onPressed: onPressed, child: text),
        KDButtonVariant.text => TextButton(onPressed: onPressed, child: text),
      };
    }

    final leading = isBusy ? _buildBusyIndicator(context) : Icon(icon);
    return switch (variant) {
      KDButtonVariant.primary => FilledButton.icon(
        onPressed: onPressed,
        icon: leading,
        label: text,
      ),
      KDButtonVariant.secondary => OutlinedButton.icon(
        onPressed: onPressed,
        icon: leading,
        label: text,
      ),
      KDButtonVariant.text => TextButton.icon(onPressed: onPressed, icon: leading, label: text),
    };
  }

  @override
  Widget build(BuildContext context) {
    final callback = isEnabled && !isBusy ? onPressed : null;

    if (_isIconOnly) return _buildIconOnly(context, callback);

    final button = _buildLabelled(context, callback);
    if (tooltip == null) return button;
    return Tooltip(message: tooltip!, child: button);
  }
}
