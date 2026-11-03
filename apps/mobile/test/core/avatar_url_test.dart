import 'package:at_tayyibun/core/avatar_url.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('allowed', () {
    test('the absolute preset form the web and app store', () {
      const url = 'https://attayyibun.com/avatars/male/male-5.jpg';
      expect(trustedAvatarUrl(url), url);
    });

    test('a relative preset path resolves to the app origin', () {
      expect(trustedAvatarUrl('/avatars/female/female-1.jpg'),
          'https://attayyibun.com/avatars/female/female-1.jpg');
    });
  });

  group('refused', () {
    for (final url in [
      '',
      '   ',
      'not a url at all',
      // The API's fallback for a member with no image.
      'https://api.dicebear.com/9.x/adventurer/svg?seed=abc',
      // A provider photo copied to users.image at sign-in.
      'https://lh3.googleusercontent.com/a/ACg8ocL3-example',
      'https://appleid.cdn-apple.com/x.jpg',
      'https://evil.example/avatars/male/male-1.jpg',
      'https://attayyibun.com.evil.example/avatars/male/male-1.jpg',
      'https://attayyibun.com@evil.example/avatars/male/male-1.jpg',
      'https://user@attayyibun.com/avatars/male/male-1.jpg',
      'http://attayyibun.com/avatars/male/male-1.jpg',
      'https://attayyibun.com:8443/avatars/male/male-1.jpg',
      'file:///avatars/male/male-1.jpg',
      'data:image/svg+xml;base64,PHN2Zz4=',
      // Same origin, but not a preset.
      'https://attayyibun.com/api/users/me',
      'https://attayyibun.com/avatars/../api/users/me.jpg',
      'https://attayyibun.com/avatars/%2e%2e/api/x.jpg',
      // SVG is never loaded from a URL, even from our own origin.
      'https://attayyibun.com/avatars/male/male-1.svg',
      'https://attayyibun.com/avatars/male/male-1.SVG',
    ]) {
      test("'$url'", () => expect(trustedAvatarUrl(url), isNull));
    }
  });
}
