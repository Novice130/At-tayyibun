import 'package:at_tayyibun/core/deep_links.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('deepLinkLocation', () {
    String? map(String link) => deepLinkLocation(Uri.parse(link));

    test('maps the site requests page to the requests tab', () {
      expect(map('https://attayyibun.com/requests'), '/requests');
      expect(map('https://attayyibun.com/requests/'), '/requests');
      expect(map('https://www.attayyibun.com/requests'), '/requests');
      expect(map('/requests'), '/requests');
    });

    test('maps a profile page to the profile screen', () {
      expect(map('https://attayyibun.com/profiles/AbC_12-x'), '/profiles/AbC_12-x');
      expect(map('/profiles/abc123'), '/profiles/abc123');
    });

    test('drops query and fragment', () {
      expect(map('https://attayyibun.com/requests?tab=sent#x'), '/requests');
    });

    test('ignores paths the app does not handle', () {
      expect(map('https://attayyibun.com/'), isNull);
      expect(map('https://attayyibun.com/browse'), isNull);
      expect(map('https://attayyibun.com/requests/req-1/contact'), isNull);
      expect(map('https://attayyibun.com/profiles'), isNull);
      expect(map('https://attayyibun.com/profiles/a/b'), isNull);
      expect(map('https://attayyibun.com/admin'), isNull);
      expect(map('/profile/edit'), isNull);
    });

    test('rejects other hosts, schemes and ports', () {
      expect(map('https://evil.example/requests'), isNull);
      expect(map('https://attayyibun.com.evil.example/requests'), isNull);
      expect(map('http://attayyibun.com/requests'), isNull);
      expect(map('https://attayyibun.com:8443/requests'), isNull);
      expect(map('//evil.example/requests'), isNull);
      expect(map('attayyibun://requests'), isNull);
    });

    test('rejects malformed profile ids', () {
      expect(map('/profiles/..'), isNull);
      expect(map('/profiles/a%20b'), isNull);
      expect(map('/profiles/${'a' * 65}'), isNull);
    });
  });

  group('pushLocation', () {
    test('reads the path field', () {
      expect(pushLocation({'path': '/requests'}), '/requests');
      expect(pushLocation({'path': '/profiles/abc'}), '/profiles/abc');
    });

    test('ignores missing, empty, foreign or unknown paths', () {
      expect(pushLocation({}), isNull);
      expect(pushLocation({'path': ''}), isNull);
      expect(pushLocation({'path': 42}), isNull);
      expect(pushLocation({'path': '/admin'}), isNull);
      expect(pushLocation({'path': 'https://evil.example/requests'}), isNull);
    });
  });
}
