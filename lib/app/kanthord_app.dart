import 'package:flutter/material.dart';

import '../libraries/kd_design_system/gallery/kd_gallery_page.dart';
import '../libraries/kd_design_system/styles/kd_theme.dart';

final class KanthorDApp extends StatefulWidget {
  const KanthorDApp({super.key});

  @override
  State<KanthorDApp> createState() => _KanthorDAppState();
}

class _KanthorDAppState extends State<KanthorDApp> {
  ThemeMode _themeMode = ThemeMode.system;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'KanthorD',
      theme: KDTheme.light(),
      darkTheme: KDTheme.dark(),
      themeMode: _themeMode,
      home: KDGalleryPage(onThemeModeChanged: (mode) => setState(() => _themeMode = mode)),
    );
  }
}
