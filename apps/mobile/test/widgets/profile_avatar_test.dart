import 'package:at_tayyibun/widgets/profile_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> _pump(WidgetTester tester, String url) => tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: ProfileAvatar(url: url, fallbackLabel: 'Sara')),
      ),
    );

void main() {
  testWidgets('a preset loads as a network image', (tester) async {
    await _pump(tester, 'https://attayyibun.com/avatars/female/female-1.jpg');
    expect(find.byType(Image), findsOneWidget);
  });

  for (final url in [
    'https://api.dicebear.com/9.x/adventurer/svg?seed=abc',
    'https://lh3.googleusercontent.com/a/photo',
    'https://evil.example/x.svg',
    '',
  ]) {
    testWidgets("'$url' shows the initial, with no fetch", (tester) async {
      await _pump(tester, url);
      expect(find.byType(Image), findsNothing);
      expect(find.byType(SvgPicture), findsNothing);
      expect(find.text('S'), findsOneWidget);
    });
  }
}
