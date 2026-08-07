import 'package:flutter/material.dart';

import '../atoms/kd_text.dart';
import '../layout/kd_layout.dart';
import '../layout/kd_layout_family.dart';
import '../molecules/kd_brand.dart';
import '../styles/kd_text_styles.dart';
import '../styles/kd_tokens.dart';

enum KDConnectionStatus {
  connecting,
  connected,
  degraded,
  unauthorized,
  unreachable;

  String get label {
    return switch (this) {
      KDConnectionStatus.connecting => 'Connecting',
      KDConnectionStatus.connected => 'Connected',
      KDConnectionStatus.degraded => 'Degraded',
      KDConnectionStatus.unauthorized => 'Unauthorized',
      KDConnectionStatus.unreachable => 'Unreachable',
    };
  }

  IconData get icon {
    return switch (this) {
      KDConnectionStatus.connecting => Icons.sync,
      KDConnectionStatus.connected => Icons.check_circle_outline,
      KDConnectionStatus.degraded => Icons.warning_amber_outlined,
      KDConnectionStatus.unauthorized => Icons.lock_outline,
      KDConnectionStatus.unreachable => Icons.cloud_off_outlined,
    };
  }

  Color color(KDStatusColors statusColors) {
    return switch (this) {
      KDConnectionStatus.connecting => statusColors.neutral,
      KDConnectionStatus.connected => statusColors.healthy,
      KDConnectionStatus.degraded => statusColors.warning,
      KDConnectionStatus.unauthorized => statusColors.danger,
      KDConnectionStatus.unreachable => statusColors.danger,
    };
  }
}

final class KDTopBar extends StatelessWidget implements PreferredSizeWidget {
  const KDTopBar({
    this.title,
    this.leading,
    this.actions = const <Widget>[],
    this.status,
    this.statusDetail,
    this.onStatusPressed,
    super.key,
  });

  final String? title;
  final Widget? leading;
  final List<Widget> actions;
  final KDConnectionStatus? status;
  final String? statusDetail;
  final VoidCallback? onStatusPressed;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  Widget _buildTitle(BuildContext context, KDLayoutFamily family) {
    final tokens = context.kdTokens;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        KDBrand(size: KDBrandSize.small, showWordmark: !family.isMobile),
        if (title != null) ...[
          SizedBox(width: tokens.spacing.md),
          Flexible(child: KDText(title!, role: KDTextRole.titleMedium, maxLines: 1)),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return KDLayout(
      child: Builder(
        builder: (context) {
          final family = context.kdLayout;
          final tokens = context.kdTokens;
          return AppBar(
            leading: leading,
            automaticallyImplyLeading: false,
            titleSpacing: tokens.spacing.lg,
            title: _buildTitle(context, family),
            actions: [
              if (status != null)
                Center(
                  child: _KDStatusIndicator(
                    status: status!,
                    detail: statusDetail,
                    isLabelVisible: !family.isMobile,
                    onPressed: onStatusPressed,
                  ),
                ),
              for (final action in actions) Center(child: action),
              SizedBox(width: tokens.spacing.sm),
            ],
          );
        },
      ),
    );
  }
}

final class _KDStatusIndicator extends StatelessWidget {
  const _KDStatusIndicator({
    required this.status,
    required this.detail,
    required this.isLabelVisible,
    required this.onPressed,
  });

  final KDConnectionStatus status;
  final String? detail;
  final bool isLabelVisible;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;
    final color = status.color(tokens.statusColors);
    final message = detail ?? status.label;

    final avatar = status == KDConnectionStatus.connecting
        ? SizedBox(
            width: tokens.spacing.lg,
            height: tokens.spacing.lg,
            child: CircularProgressIndicator(strokeWidth: 2, color: color),
          )
        : Icon(status.icon, size: tokens.spacing.lg, color: color);

    if (!isLabelVisible) {
      if (onPressed == null) {
        return Tooltip(
          message: message,
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: tokens.spacing.md),
            child: avatar,
          ),
        );
      }
      return IconButton(onPressed: onPressed, tooltip: message, icon: avatar);
    }

    final label = KDText(status.label, role: KDTextRole.labelLarge);
    return Tooltip(
      message: message,
      child: onPressed == null
          ? Chip(avatar: avatar, label: label)
          : ActionChip(avatar: avatar, label: label, onPressed: onPressed),
    );
  }
}
