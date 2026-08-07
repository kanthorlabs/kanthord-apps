import 'package:flutter/material.dart';

import '../atoms/kd_button.dart';
import '../styles/kd_tokens.dart';
import 'kd_layout.dart';

final class KDPaneView extends StatelessWidget {
  const KDPaneView({
    required this.list,
    this.detail,
    this.placeholder,
    this.onDetailClosed,
    this.listWidth,
    super.key,
  });

  final Widget list;
  final Widget? detail;
  final Widget? placeholder;
  final VoidCallback? onDetailClosed;
  final double? listWidth;

  Widget _buildMobile(BuildContext context) {
    if (detail == null) return list;
    if (onDetailClosed == null) return detail!;

    final tokens = context.kdTokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.symmetric(horizontal: tokens.spacing.sm),
          child: KDButton.icon(
            icon: Icons.arrow_back,
            tooltip: 'Back to the list',
            onPressed: onDetailClosed,
          ),
        ),
        Expanded(child: detail!),
      ],
    );
  }

  Widget _buildSplit(BuildContext context) {
    return Row(
      children: [
        SizedBox(width: listWidth ?? context.kdTokens.sizing.paneListWidth, child: list),
        const VerticalDivider(width: 1, thickness: 1),
        Expanded(child: detail ?? placeholder ?? const SizedBox.shrink()),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return KDLayout(
      child: Builder(
        builder: (context) {
          if (context.kdLayout.isMobile) return _buildMobile(context);
          return _buildSplit(context);
        },
      ),
    );
  }
}
