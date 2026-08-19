// Theme smoke tests. The full app boot requires a real ApiClient (cookie jar
// on disk), so entry-point coverage lives in the manual device pass instead.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:at_tayyibun/core/theme.dart';

void main() {
  testWidgets('light and dark palettes build with the brand gold',
      (WidgetTester tester) async {
    expect(buildLightTheme().colorScheme.primary, BrandColors.gold500);
    expect(buildDarkTheme().brightness, Brightness.dark);
    expect(buildDarkTheme().colorScheme.primary, BrandColors.gold500);
  });
}
