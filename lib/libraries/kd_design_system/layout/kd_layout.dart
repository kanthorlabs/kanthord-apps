import 'package:flutter/widgets.dart';

import 'kd_layout_family.dart';

const double kdWideBreakpoint = 600;

final class _KDLayoutScope extends InheritedWidget {
  const _KDLayoutScope({required this.family, required super.child});

  final KDLayoutFamily family;

  @override
  bool updateShouldNotify(_KDLayoutScope oldWidget) => family != oldWidget.family;
}

final class KDLayout extends StatelessWidget {
  const KDLayout({required this.child, super.key});

  final Widget child;

  static KDLayoutFamily familyForWidth(double width) {
    return width < kdWideBreakpoint ? KDLayoutFamily.mobile : KDLayoutFamily.wide;
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return _KDLayoutScope(family: familyForWidth(constraints.maxWidth), child: child);
      },
    );
  }
}

extension KDLayoutAccess on BuildContext {
  KDLayoutFamily get kdLayout {
    final scope = dependOnInheritedWidgetOfExactType<_KDLayoutScope>();
    assert(scope != null, 'context.kdLayout requires a KDLayout ancestor');
    return scope!.family;
  }
}
