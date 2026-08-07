import 'package:flutter/material.dart';

import '../atoms/kd_button.dart';
import '../atoms/kd_text.dart';
import '../styles/kd_text_styles.dart';
import '../styles/kd_tokens.dart';
import 'kd_layout.dart';

enum KDDialogSize { standard, large }

final class KDDialog extends StatelessWidget {
  const KDDialog({
    required this.title,
    required this.child,
    this.actions = const <Widget>[],
    this.onClose,
    this.size = KDDialogSize.standard,
    super.key,
  });

  final String title;
  final Widget child;
  final List<Widget> actions;
  final VoidCallback? onClose;
  final KDDialogSize size;

  static Future<T?> show<T>(
    BuildContext context, {
    required WidgetBuilder builder,
    bool isDismissible = true,
  }) {
    return showDialog<T>(
      context: context,
      barrierDismissible: isDismissible,
      useSafeArea: false,
      builder: builder,
    );
  }

  double _maxWidth(KDSizing sizing) {
    return switch (size) {
      KDDialogSize.standard => sizing.contentMaxWidth,
      KDDialogSize.large => sizing.dialogLargeWidth,
    };
  }

  Widget _buildCloseButton() {
    return KDButton.icon(icon: Icons.close, tooltip: 'Close', onPressed: onClose);
  }

  Widget _buildActions(BuildContext context) {
    final tokens = context.kdTokens;
    return Padding(
      padding: EdgeInsets.all(tokens.spacing.lg),
      child: Wrap(
        alignment: WrapAlignment.end,
        spacing: tokens.spacing.sm,
        runSpacing: tokens.spacing.sm,
        children: actions,
      ),
    );
  }

  Widget _buildMobile(BuildContext context) {
    final tokens = context.kdTokens;
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        leading: onClose == null ? null : _buildCloseButton(),
        title: KDText(title, role: KDTextRole.titleLarge, maxLines: 1),
      ),
      body: SingleChildScrollView(padding: EdgeInsets.all(tokens.spacing.lg), child: child),
      bottomNavigationBar: actions.isEmpty ? null : SafeArea(child: _buildActions(context)),
    );
  }

  Widget _buildDialog(BuildContext context) {
    final tokens = context.kdTokens;
    return Dialog(
      insetPadding: EdgeInsets.all(tokens.spacing.xxl),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: _maxWidth(tokens.sizing)),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(
                tokens.spacing.xl,
                tokens.spacing.lg,
                onClose == null ? tokens.spacing.xl : tokens.spacing.sm,
                tokens.spacing.lg,
              ),
              child: Row(
                children: [
                  Expanded(child: KDText(title, role: KDTextRole.titleLarge, maxLines: 2)),
                  if (onClose != null) _buildCloseButton(),
                ],
              ),
            ),
            const Divider(height: 1, thickness: 1),
            Flexible(
              child: SingleChildScrollView(
                padding: EdgeInsets.all(tokens.spacing.xl),
                child: child,
              ),
            ),
            if (actions.isNotEmpty) ...[
              const Divider(height: 1, thickness: 1),
              _buildActions(context),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return KDLayout(
      child: Builder(
        builder: (context) {
          if (context.kdLayout.isMobile) return _buildMobile(context);
          return _buildDialog(context);
        },
      ),
    );
  }
}
