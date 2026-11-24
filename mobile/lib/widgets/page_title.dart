import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// AppBar title matching the web PageHeader: optional subtitle ABOVE the title
/// (text-xs slate-400), title text-xl (16px) bold slate-900, left-aligned.
class PageTitle extends StatelessWidget {
  final String title;
  final String? subtitle;
  const PageTitle(this.title, {super.key, this.subtitle});

  @override
  Widget build(BuildContext context) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (subtitle != null) Text(subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.pageSubtitle),
          Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.pageTitle),
        ],
      );
}
