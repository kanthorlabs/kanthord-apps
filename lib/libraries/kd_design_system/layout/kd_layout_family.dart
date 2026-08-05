enum KDLayoutFamily {
  mobile,
  wide;

  bool get isMobile => this == KDLayoutFamily.mobile;

  bool get isWide => this == KDLayoutFamily.wide;
}
