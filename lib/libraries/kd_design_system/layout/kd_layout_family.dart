enum KDLayoutFamily {
  mobile,
  wide,
  expanded;

  bool get isMobile => this == KDLayoutFamily.mobile;

  bool get isWide => this == KDLayoutFamily.wide;

  bool get isExpanded => this == KDLayoutFamily.expanded;
}
