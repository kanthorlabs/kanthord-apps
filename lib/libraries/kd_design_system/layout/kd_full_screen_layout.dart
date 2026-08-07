import 'package:flutter/material.dart';

import '../molecules/kd_brand.dart';
import '../styles/kd_tokens.dart';
import 'kd_layout.dart';

final class KDFullScreenLayout extends StatelessWidget {
  const KDFullScreenLayout({
    required this.child,
    this.showBrand = true,
    this.footer,
    this.maxContentWidth,
    super.key,
  });

  final Widget child;
  final bool showBrand;
  final Widget? footer;
  final double? maxContentWidth;

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;

    return KDLayout(
      child: Scaffold(
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: EdgeInsets.all(tokens.spacing.xl),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: maxContentWidth ?? tokens.sizing.contentMaxWidth,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (showBrand) ...[
                      const Center(child: KDBrand(size: KDBrandSize.large)),
                      SizedBox(height: tokens.spacing.xxl),
                    ],
                    child,
                    if (footer != null) ...[SizedBox(height: tokens.spacing.xl), footer!],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
