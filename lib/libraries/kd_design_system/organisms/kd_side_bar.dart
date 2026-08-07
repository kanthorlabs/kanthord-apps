import 'package:flutter/material.dart';

import '../atoms/kd_text.dart';
import '../layout/kd_destination.dart';
import '../styles/kd_text_styles.dart';
import '../styles/kd_tokens.dart';

@immutable
final class KDSideBarSection {
  const KDSideBarSection({required this.destinations, this.label});

  final String? label;
  final List<KDDestination> destinations;
}

final class KDSideBar extends StatelessWidget {
  const KDSideBar({
    required this.sections,
    required this.selectedIndex,
    required this.onDestinationSelected,
    this.header,
    this.footer,
    this.width,
    super.key,
  });

  final List<KDSideBarSection> sections;
  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final Widget? header;
  final Widget? footer;
  final double? width;

  List<Widget> _buildChildren(BuildContext context) {
    final tokens = context.kdTokens;
    final children = <Widget>[];

    for (var index = 0; index < sections.length; index++) {
      final section = sections[index];
      if (section.label != null) {
        children.add(
          Padding(
            padding: EdgeInsets.fromLTRB(
              tokens.spacing.xl,
              tokens.spacing.lg,
              tokens.spacing.xl,
              tokens.spacing.sm,
            ),
            child: KDText(section.label!, role: KDTextRole.labelLarge, tone: KDTextTone.secondary),
          ),
        );
      }
      for (final destination in section.destinations) {
        children.add(
          NavigationDrawerDestination(
            icon: Icon(destination.icon),
            selectedIcon: Icon(destination.selectedIcon),
            label: Text(destination.label),
          ),
        );
      }
      if (index < sections.length - 1) {
        children.add(
          Padding(
            padding: EdgeInsets.symmetric(vertical: tokens.spacing.sm),
            child: const Divider(height: 1, thickness: 1),
          ),
        );
      }
    }

    return children;
  }

  @override
  Widget build(BuildContext context) {
    final effectiveWidth = width ?? context.kdTokens.sizing.sideBarWidth;
    return DrawerTheme(
      data: DrawerTheme.of(
        context,
      ).copyWith(width: effectiveWidth, shape: const RoundedRectangleBorder()),
      child: NavigationDrawer(
        selectedIndex: selectedIndex,
        onDestinationSelected: onDestinationSelected,
        header: header,
        footer: footer,
        children: _buildChildren(context),
      ),
    );
  }
}
