import 'package:flutter/material.dart';

import '../atoms/kd_text.dart';
import '../layout/kd_adaptive_scaffold.dart';
import '../layout/kd_layout.dart';
import '../molecules/kd_card.dart';
import '../organisms/kd_card_list.dart';
import '../styles/kd_text_styles.dart';
import '../styles/kd_tokens.dart';

final class KDGalleryPage extends StatefulWidget {
  const KDGalleryPage({required this.onThemeModeChanged, super.key});

  final ValueChanged<ThemeMode> onThemeModeChanged;

  @override
  State<KDGalleryPage> createState() => _KDGalleryPageState();
}

class _KDGalleryPageState extends State<KDGalleryPage> {
  int _selectedIndex = 0;
  String? _highlightedId;

  static const List<KDDestination> _destinations = [
    KDDestination(
      label: 'Atoms',
      icon: Icons.text_fields_outlined,
      selectedIcon: Icons.text_fields,
    ),
    KDDestination(
      label: 'Molecules',
      icon: Icons.dashboard_outlined,
      selectedIcon: Icons.dashboard,
    ),
    KDDestination(
      label: 'Organisms',
      icon: Icons.view_list_outlined,
      selectedIcon: Icons.view_list,
    ),
  ];

  void _toggleThemeMode() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    widget.onThemeModeChanged(isDark ? ThemeMode.light : ThemeMode.dark);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return KDAdaptiveScaffold(
      destinations: _destinations,
      selectedIndex: _selectedIndex,
      onDestinationSelected: (index) => setState(() => _selectedIndex = index),
      appBar: AppBar(
        title: const Text('KD gallery'),
        actions: [
          IconButton(
            onPressed: _toggleThemeMode,
            icon: Icon(isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
            tooltip: isDark ? 'Use the light theme' : 'Use the dark theme',
          ),
        ],
      ),
      body: switch (_selectedIndex) {
        0 => const _AtomsSection(),
        1 => const _MoleculesSection(),
        _ => _OrganismsSection(
          highlightedId: _highlightedId,
          onItemTap: (item) => setState(() => _highlightedId = item.id),
        ),
      },
    );
  }
}

final class _SectionBody extends StatelessWidget {
  const _SectionBody({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;
    return ListView(
      padding: EdgeInsets.all(tokens.spacing.lg),
      children: [
        KDText(title, role: KDTextRole.headlineSmall),
        SizedBox(height: tokens.spacing.xs),
        KDText(
          'Layout family: ${context.kdLayout.name}',
          role: KDTextRole.labelLarge,
          tone: KDTextTone.secondary,
        ),
        SizedBox(height: tokens.spacing.lg),
        ...children,
      ],
    );
  }
}

final class _AtomsSection extends StatelessWidget {
  const _AtomsSection();

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;
    return _SectionBody(
      title: 'KDText',
      children: [
        for (final role in KDTextRole.values) ...[
          KDText(role.name, role: role),
          SizedBox(height: tokens.spacing.sm),
        ],
        SizedBox(height: tokens.spacing.lg),
        KDText('KDTextTone.secondary', tone: KDTextTone.secondary),
        SizedBox(height: tokens.spacing.sm),
        KDText('KDTextTone.error', tone: KDTextTone.error),
      ],
    );
  }
}

final class _MoleculesSection extends StatelessWidget {
  const _MoleculesSection();

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;
    return _SectionBody(
      title: 'KDCard',
      children: [
        const KDCard(title: 'Title only'),
        SizedBox(height: tokens.spacing.sm),
        const KDCard(
          title: 'Title and description',
          description: 'A card carries one piece of data and one purpose.',
          leading: Icon(Icons.smart_toy_outlined),
          trailing: Icon(Icons.chevron_right),
        ),
        SizedBox(height: tokens.spacing.sm),
        const KDCard(title: 'isHighlighted', description: 'Selected state.', isHighlighted: true),
        SizedBox(height: tokens.spacing.sm),
        const KDCard(title: 'isEnabled false', description: 'Disabled state.', isEnabled: false),
      ],
    );
  }
}

final class _OrganismsSection extends StatelessWidget {
  const _OrganismsSection({required this.highlightedId, required this.onItemTap});

  final String? highlightedId;
  final ValueChanged<KDCardListItem> onItemTap;

  static const List<KDCardListItem> _items = [
    KDCardListItem(
      id: 'planner',
      title: 'Planner agent',
      description: 'Breaks a request into ordered steps.',
      leading: Icon(Icons.account_tree_outlined),
    ),
    KDCardListItem(
      id: 'researcher',
      title: 'Researcher agent',
      description: 'Reads sources and returns citations.',
      leading: Icon(Icons.travel_explore_outlined),
    ),
    KDCardListItem(
      id: 'writer',
      title: 'Writer agent',
      description: 'Turns notes into a final answer.',
      leading: Icon(Icons.edit_outlined),
    ),
    KDCardListItem(
      id: 'offline',
      title: 'Offline agent',
      description: 'Not available right now.',
      leading: Icon(Icons.cloud_off_outlined),
      isEnabled: false,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(tokens.spacing.lg, tokens.spacing.lg, tokens.spacing.lg, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              KDText('KDCardList', role: KDTextRole.headlineSmall),
              SizedBox(height: tokens.spacing.xs),
              KDText(
                'Layout family: ${context.kdLayout.name}',
                role: KDTextRole.labelLarge,
                tone: KDTextTone.secondary,
              ),
            ],
          ),
        ),
        Expanded(
          child: KDCardList(items: _items, highlightedId: highlightedId, onItemTap: onItemTap),
        ),
      ],
    );
  }
}
