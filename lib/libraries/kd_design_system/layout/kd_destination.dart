import 'package:flutter/widgets.dart';

@immutable
final class KDDestination {
  const KDDestination({required this.label, required this.icon, required this.selectedIcon});

  final String label;
  final IconData icon;
  final IconData selectedIcon;
}
