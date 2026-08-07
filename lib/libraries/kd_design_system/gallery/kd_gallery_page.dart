import 'package:flutter/material.dart';

import '../atoms/kd_button.dart';
import '../atoms/kd_input_field.dart';
import '../atoms/kd_text.dart';
import '../layout/kd_destination.dart';
import '../layout/kd_dialog.dart';
import '../layout/kd_full_screen_layout.dart';
import '../layout/kd_layout.dart';
import '../layout/kd_pane_view.dart';
import '../layout/kd_shell_layout.dart';
import '../layout/kd_status_view.dart';
import '../molecules/kd_brand.dart';
import '../molecules/kd_card.dart';
import '../organisms/kd_card_list.dart';
import '../organisms/kd_side_bar.dart';
import '../organisms/kd_top_bar.dart';
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
  KDConnectionStatus _status = KDConnectionStatus.connected;

  static const List<KDSideBarSection> _sections = [
    KDSideBarSection(
      label: 'Components',
      destinations: [
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
      ],
    ),
    KDSideBarSection(
      label: 'Layouts',
      destinations: [
        KDDestination(label: 'States', icon: Icons.info_outline, selectedIcon: Icons.info),
        KDDestination(
          label: 'Templates',
          icon: Icons.web_asset_outlined,
          selectedIcon: Icons.web_asset,
        ),
      ],
    ),
  ];

  void _toggleThemeMode() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    widget.onThemeModeChanged(isDark ? ThemeMode.light : ThemeMode.dark);
  }

  void _cycleStatus() {
    final next = (_status.index + 1) % KDConnectionStatus.values.length;
    setState(() => _status = KDConnectionStatus.values[next]);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return KDShellLayout(
      title: 'KD gallery',
      status: _status,
      statusDetail: 'Press to cycle the demo state',
      onStatusPressed: _cycleStatus,
      sections: _sections,
      selectedIndex: _selectedIndex,
      onDestinationSelected: (index) => setState(() => _selectedIndex = index),
      actions: [
        KDButton.icon(
          icon: isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
          tooltip: isDark ? 'Use the light theme' : 'Use the dark theme',
          onPressed: _toggleThemeMode,
        ),
      ],
      content: switch (_selectedIndex) {
        0 => const _AtomsSection(),
        1 => const _MoleculesSection(),
        2 => _OrganismsSection(
          highlightedId: _highlightedId,
          onItemTap: (item) => setState(() => _highlightedId = item.id),
        ),
        3 => const _StatesSection(),
        _ => const _TemplatesSection(),
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

final class _Subtitle extends StatelessWidget {
  const _Subtitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;
    return Padding(
      padding: EdgeInsets.only(top: tokens.spacing.xl, bottom: tokens.spacing.sm),
      child: KDText(text, role: KDTextRole.titleMedium),
    );
  }
}

final class _Frame extends StatelessWidget {
  const _Frame({required this.child, required this.height, this.width});

  final Widget child;
  final double height;
  final double? width;

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      width: width,
      height: height,
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border.all(color: scheme.outlineVariant),
          borderRadius: BorderRadius.circular(tokens.radius.md),
        ),
        child: ClipRRect(borderRadius: BorderRadius.circular(tokens.radius.md), child: child),
      ),
    );
  }
}

final class _AtomsSection extends StatelessWidget {
  const _AtomsSection();

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;
    return _SectionBody(
      title: 'KDText and KDButton',
      children: [
        for (final role in KDTextRole.values) ...[
          KDText(role.name, role: role),
          SizedBox(height: tokens.spacing.sm),
        ],
        SizedBox(height: tokens.spacing.lg),
        KDText('KDTextTone.secondary', tone: KDTextTone.secondary),
        SizedBox(height: tokens.spacing.sm),
        KDText('KDTextTone.error', tone: KDTextTone.error),
        const _Subtitle('KDButton'),
        Wrap(
          spacing: tokens.spacing.sm,
          runSpacing: tokens.spacing.sm,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            KDButton(label: 'primary', onPressed: () {}),
            KDButton(label: 'secondary', variant: KDButtonVariant.secondary, onPressed: () {}),
            KDButton(label: 'text', variant: KDButtonVariant.text, onPressed: () {}),
            KDButton(label: 'with icon', icon: Icons.link, onPressed: () {}),
            const KDButton(label: 'isEnabled false', isEnabled: false),
            KDButton(label: 'isBusy', isBusy: true, onPressed: () {}),
          ],
        ),
        const _Subtitle('KDButton.icon'),
        Wrap(
          spacing: tokens.spacing.sm,
          runSpacing: tokens.spacing.sm,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            KDButton.icon(icon: Icons.refresh, tooltip: 'text variant', onPressed: () {}),
            KDButton.icon(
              icon: Icons.play_arrow,
              tooltip: 'primary variant',
              variant: KDButtonVariant.primary,
              onPressed: () {},
            ),
            KDButton.icon(
              icon: Icons.settings_outlined,
              tooltip: 'secondary variant',
              variant: KDButtonVariant.secondary,
              onPressed: () {},
            ),
            KDButton.icon(icon: Icons.sync, tooltip: 'isBusy', isBusy: true, onPressed: () {}),
          ],
        ),
        const _Subtitle('KDInputField'),
        const KDInputField(
          label: 'Base URL',
          hint: 'http://127.0.0.1:8080',
          helper: 'The daemon has no default port. Enter the one it binds.',
          keyboardType: TextInputType.url,
        ),
        SizedBox(height: tokens.spacing.lg),
        const KDInputField(
          label: 'Token',
          isObscured: true,
          initialValue: 'kd_a1b2c3d4e5f6',
          helper: 'The value of KANTHORD_HTTP_TOKEN on the daemon.',
        ),
        SizedBox(height: tokens.spacing.lg),
        const KDInputField(
          label: 'Base URL',
          initialValue: 'http:/127.0.0.1',
          error: 'The URL needs a scheme, a host and a port.',
        ),
        SizedBox(height: tokens.spacing.lg),
        const KDInputField(
          label: 'isEnabled false',
          initialValue: 'kd_a1b2c3d4e5f6',
          isObscured: true,
          isEnabled: false,
        ),
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
      title: 'KDCard and KDBrand',
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
        const _Subtitle('KDBrand'),
        const Align(
          alignment: Alignment.centerLeft,
          child: KDBrand(size: KDBrandSize.large),
        ),
        SizedBox(height: tokens.spacing.lg),
        const Align(alignment: Alignment.centerLeft, child: KDBrand()),
        SizedBox(height: tokens.spacing.lg),
        const Align(
          alignment: Alignment.centerLeft,
          child: KDBrand(size: KDBrandSize.small),
        ),
        SizedBox(height: tokens.spacing.lg),
        const Align(
          alignment: Alignment.centerLeft,
          child: KDBrand(size: KDBrandSize.medium, showWordmark: false),
        ),
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

  static const List<KDSideBarSection> _navigation = [
    KDSideBarSection(
      label: 'Plan',
      destinations: [
        KDDestination(label: 'Projects', icon: Icons.folder_outlined, selectedIcon: Icons.folder),
        KDDestination(
          label: 'Nodes',
          icon: Icons.account_tree_outlined,
          selectedIcon: Icons.account_tree,
        ),
      ],
    ),
    KDSideBarSection(
      label: 'System',
      destinations: [
        KDDestination(label: 'Activity', icon: Icons.history_outlined, selectedIcon: Icons.history),
        KDDestination(
          label: 'Settings',
          icon: Icons.settings_outlined,
          selectedIcon: Icons.settings,
        ),
      ],
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;
    return _SectionBody(
      title: 'KDCardList, KDTopBar and KDSideBar',
      children: [
        _Frame(
          height: 320,
          child: KDCardList(items: _items, highlightedId: highlightedId, onItemTap: onItemTap),
        ),
        const _Subtitle('KDTopBar'),
        for (final status in KDConnectionStatus.values) ...[
          _Frame(
            height: kToolbarHeight,
            child: KDTopBar(title: status.label, status: status, onStatusPressed: () {}),
          ),
          SizedBox(height: tokens.spacing.sm),
        ],
        const _Subtitle('KDSideBar'),
        _Frame(
          height: 360,
          width: tokens.sizing.sideBarWidth,
          child: KDSideBar(sections: _navigation, selectedIndex: 1, onDestinationSelected: (_) {}),
        ),
      ],
    );
  }
}

final class _StatesSection extends StatelessWidget {
  const _StatesSection();

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;
    return _SectionBody(
      title: 'KDStatusView',
      children: [
        const _Subtitle('loading'),
        const _Frame(
          height: 240,
          child: KDStatusView(kind: KDStatusKind.loading, title: 'Reading the node list'),
        ),
        const _Subtitle('empty'),
        const _Frame(
          height: 240,
          child: KDStatusView(
            kind: KDStatusKind.empty,
            title: 'No node matches the filter',
            message: 'Clear the state filter, or import a plan into this project.',
          ),
        ),
        const _Subtitle('notImplemented'),
        const _Frame(
          height: 280,
          child: KDStatusView(
            kind: KDStatusKind.notImplemented,
            title: 'The daemon does not do this yet',
            message: 'node.list answers 501 not-implemented. It lands in daemon phase 1.',
          ),
        ),
        const _Subtitle('error'),
        _Frame(
          height: 300,
          child: KDStatusView(
            kind: KDStatusKind.error,
            title: 'The daemon is unreachable',
            message: 'Check the base URL, and check that the daemon runs on that port.',
            actions: [
              KDButton(label: 'Retry', onPressed: () {}),
              KDButton(
                label: 'Change the URL',
                variant: KDButtonVariant.secondary,
                onPressed: () {},
              ),
            ],
          ),
        ),
        SizedBox(height: tokens.spacing.lg),
      ],
    );
  }
}

final class _TemplatesSection extends StatelessWidget {
  const _TemplatesSection();

  static const List<KDSideBarSection> _navigation = [
    KDSideBarSection(
      label: 'Plan',
      destinations: [
        KDDestination(label: 'Projects', icon: Icons.folder_outlined, selectedIcon: Icons.folder),
        KDDestination(
          label: 'Nodes',
          icon: Icons.account_tree_outlined,
          selectedIcon: Icons.account_tree,
        ),
      ],
    ),
    KDSideBarSection(
      label: 'System',
      destinations: [
        KDDestination(label: 'Activity', icon: Icons.history_outlined, selectedIcon: Icons.history),
      ],
    ),
  ];

  Widget _buildShellPreview(BuildContext context, {required double width, required String label}) {
    final tokens = context.kdTokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        KDText(label, role: KDTextRole.labelLarge, tone: KDTextTone.secondary),
        SizedBox(height: tokens.spacing.xs),
        _Frame(
          width: width,
          height: 360,
          child: KDShellLayout(
            title: 'Nodes',
            status: KDConnectionStatus.connected,
            sections: _navigation,
            selectedIndex: 1,
            onDestinationSelected: (_) {},
            content: const KDStatusView(
              kind: KDStatusKind.empty,
              title: 'The content region',
              message: 'Every state renders here while the shell stays up.',
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;
    return _SectionBody(
      title: 'The page layouts and the two surfaces above them',
      children: [
        const _Subtitle('KDFullScreenLayout'),
        _Frame(
          height: 460,
          child: KDFullScreenLayout(
            footer: const KDText(
              'The token crosses the network in clear text above loopback.',
              role: KDTextRole.bodySmall,
              tone: KDTextTone.secondary,
              textAlign: TextAlign.center,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const KDText(
                  'Connect to a daemon',
                  role: KDTextRole.titleLarge,
                  textAlign: TextAlign.center,
                ),
                SizedBox(height: tokens.spacing.xl),
                const KDInputField(
                  label: 'Base URL',
                  hint: 'http://127.0.0.1:8080',
                  keyboardType: TextInputType.url,
                ),
                SizedBox(height: tokens.spacing.lg),
                const KDInputField(label: 'Token', isObscured: true),
                SizedBox(height: tokens.spacing.xl),
                KDButton(label: 'Connect', icon: Icons.link, onPressed: () {}),
              ],
            ),
          ),
        ),
        const _Subtitle('KDShellLayout in all three families'),
        const KDText(
          'Each frame resolves its own family from the width it receives, not from the window.',
          tone: KDTextTone.secondary,
        ),
        SizedBox(height: tokens.spacing.md),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildShellPreview(context, width: 520, label: 'mobile, 520'),
              SizedBox(width: tokens.spacing.lg),
              _buildShellPreview(context, width: 700, label: 'wide, 700'),
              SizedBox(width: tokens.spacing.lg),
              _buildShellPreview(context, width: 900, label: 'expanded, 900'),
            ],
          ),
        ),
        const _Subtitle('KDPaneView in the content region'),
        const KDText(
          'It splits on the width it receives. Select a row to fill the detail pane.',
          tone: KDTextTone.secondary,
        ),
        SizedBox(height: tokens.spacing.md),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _PaneViewPreview(width: 520, label: 'mobile, 520'),
              SizedBox(width: tokens.spacing.lg),
              _PaneViewPreview(width: 900, label: 'expanded, 900'),
            ],
          ),
        ),
        const _Subtitle('KDDialog above either page layout'),
        _Frame(
          height: 320,
          child: KDDialog(
            title: 'Approve this node?',
            onClose: () {},
            actions: [
              KDButton(label: 'Cancel', variant: KDButtonVariant.text, onPressed: () {}),
              KDButton(label: 'Approve', onPressed: () {}),
            ],
            child: const KDText(
              'The daemon records the approval against its configured actor. No request carries '
              'an actor, so there is no picker.',
            ),
          ),
        ),
        SizedBox(height: tokens.spacing.lg),
        const _DialogLauncher(),
        SizedBox(height: tokens.spacing.lg),
      ],
    );
  }
}

final class _PaneViewPreview extends StatefulWidget {
  const _PaneViewPreview({required this.width, required this.label});

  final double width;
  final String label;

  @override
  State<_PaneViewPreview> createState() => _PaneViewPreviewState();
}

class _PaneViewPreviewState extends State<_PaneViewPreview> {
  String? _selectedId;

  static const List<KDCardListItem> _rows = [
    KDCardListItem(
      id: 'task_01',
      title: 'Add the sessions resource',
      description: 'task, ready',
      leading: Icon(Icons.check_box_outline_blank),
    ),
    KDCardListItem(
      id: 'task_02',
      title: 'Join a multiline data field',
      description: 'task, blocked',
      leading: Icon(Icons.block_outlined),
    ),
    KDCardListItem(
      id: 'objective_01',
      title: 'Harden the transport',
      description: 'objective, running',
      leading: Icon(Icons.play_circle_outline),
    ),
  ];

  KDCardListItem? get _selected {
    for (final row in _rows) {
      if (row.id == _selectedId) return row;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;
    final selected = _selected;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        KDText(widget.label, role: KDTextRole.labelLarge, tone: KDTextTone.secondary),
        SizedBox(height: tokens.spacing.xs),
        _Frame(
          width: widget.width,
          height: 360,
          child: ColoredBox(
            color: Theme.of(context).colorScheme.surface,
            child: KDPaneView(
              list: KDCardList(
                items: _rows,
                highlightedId: _selectedId,
                onItemTap: (item) => setState(() => _selectedId = item.id),
              ),
              detail: selected == null ? null : _NodeDetailPreview(item: selected),
              onDetailClosed: () => setState(() => _selectedId = null),
              placeholder: const KDStatusView(
                kind: KDStatusKind.empty,
                title: 'No node is selected',
                message: 'Choose a node to read its attempts and its checks.',
              ),
            ),
          ),
        ),
      ],
    );
  }
}

final class _NodeDetailPreview extends StatelessWidget {
  const _NodeDetailPreview({required this.item});

  final KDCardListItem item;

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;
    return ListView(
      padding: EdgeInsets.all(tokens.spacing.lg),
      children: [
        KDText(item.title, role: KDTextRole.titleLarge),
        SizedBox(height: tokens.spacing.xs),
        KDText(item.id, role: KDTextRole.labelLarge, tone: KDTextTone.secondary),
        SizedBox(height: tokens.spacing.lg),
        const KDCard(
          title: 'Attempts',
          description: 'node.attempts answers 501 today. It is daemon phase 2.',
        ),
        SizedBox(height: tokens.spacing.sm),
        const KDCard(
          title: 'Checks',
          description: 'node.checks answers 501 today. It is daemon phase 2.',
        ),
      ],
    );
  }
}

final class _DialogLauncher extends StatelessWidget {
  const _DialogLauncher();

  Future<void> _open(BuildContext context, KDDialogSize size) async {
    await KDDialog.show<void>(
      context,
      builder: (context) => KDDialog(
        size: size,
        title: size == KDDialogSize.large ? 'sha256:4f2a…9c1b' : 'Approve this node?',
        onClose: () => Navigator.of(context).pop(),
        actions: [
          KDButton(
            label: 'Close',
            variant: KDButtonVariant.text,
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
        child: KDText(
          size == KDDialogSize.large
              ? 'A blob holds a rendered prompt, a diff or a check log. It is fetched lazily, when '
                    'the human opens it, because an attempt cites three of them by hash.'
              : 'The daemon records the approval against its configured actor.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.kdTokens;
    return Wrap(
      spacing: tokens.spacing.sm,
      runSpacing: tokens.spacing.sm,
      children: [
        KDButton(
          label: 'Open a standard dialog',
          variant: KDButtonVariant.secondary,
          onPressed: () => _open(context, KDDialogSize.standard),
        ),
        KDButton(
          label: 'Open a large dialog',
          variant: KDButtonVariant.secondary,
          onPressed: () => _open(context, KDDialogSize.large),
        ),
      ],
    );
  }
}
