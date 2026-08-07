import 'package:flutter/material.dart';

import '../organisms/kd_side_bar.dart';
import '../organisms/kd_top_bar.dart';
import 'kd_adaptive_scaffold.dart';
import 'kd_destination.dart';

final class KDShellLayout extends StatelessWidget {
  const KDShellLayout({
    required this.sections,
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.content,
    this.title,
    this.status,
    this.statusDetail,
    this.onStatusPressed,
    this.actions = const <Widget>[],
    this.floatingActionButton,
    super.key,
  });

  final List<KDSideBarSection> sections;
  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final Widget content;
  final String? title;
  final KDConnectionStatus? status;
  final String? statusDetail;
  final VoidCallback? onStatusPressed;
  final List<Widget> actions;
  final Widget? floatingActionButton;

  List<KDDestination> get _destinations {
    return [for (final section in sections) ...section.destinations];
  }

  @override
  Widget build(BuildContext context) {
    return KDAdaptiveScaffold(
      destinations: _destinations,
      sections: sections,
      selectedIndex: selectedIndex,
      onDestinationSelected: onDestinationSelected,
      appBar: KDTopBar(
        title: title,
        status: status,
        statusDetail: statusDetail,
        onStatusPressed: onStatusPressed,
        actions: actions,
      ),
      floatingActionButton: floatingActionButton,
      body: content,
    );
  }
}
