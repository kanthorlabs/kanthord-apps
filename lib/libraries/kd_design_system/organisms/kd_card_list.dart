import 'package:flutter/material.dart';

import '../molecules/kd_card.dart';
import '../styles/kd_tokens.dart';

@immutable
final class KDCardListItem {
  const KDCardListItem({
    required this.id,
    required this.title,
    this.description,
    this.leading,
    this.trailing,
    this.isEnabled = true,
  });

  final String id;
  final String title;
  final String? description;
  final Widget? leading;
  final Widget? trailing;
  final bool isEnabled;
}

final class KDCardList extends StatelessWidget {
  const KDCardList({
    required this.items,
    this.highlightedId,
    this.onItemTap,
    this.onItemLongPress,
    this.emptyPlaceholder,
    this.scrollController,
    this.padding,
    super.key,
  });

  final List<KDCardListItem> items;
  final String? highlightedId;
  final ValueChanged<KDCardListItem>? onItemTap;
  final ValueChanged<KDCardListItem>? onItemLongPress;
  final Widget? emptyPlaceholder;
  final ScrollController? scrollController;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;

    if (items.isEmpty) return emptyPlaceholder ?? const SizedBox.shrink();

    return ListView.separated(
      controller: scrollController,
      padding: padding ?? EdgeInsets.all(tokens.spacing.lg),
      itemCount: items.length,
      separatorBuilder: (context, index) => SizedBox(height: tokens.spacing.sm),
      itemBuilder: (context, index) {
        final item = items[index];
        return KDCard(
          title: item.title,
          description: item.description,
          leading: item.leading,
          trailing: item.trailing,
          isEnabled: item.isEnabled,
          isHighlighted: item.id == highlightedId,
          onTap: onItemTap == null ? null : () => onItemTap!(item),
          onLongPress: onItemLongPress == null ? null : () => onItemLongPress!(item),
        );
      },
    );
  }
}
