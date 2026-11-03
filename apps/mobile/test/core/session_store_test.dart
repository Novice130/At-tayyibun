import 'dart:io';

import 'package:at_tayyibun/core/constants.dart';
import 'package:at_tayyibun/core/session_store.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

final _base = Uri.parse(kBaseUrl);
Cookie _session(String value) =>
    Cookie(kSessionCookieSecure, value)..maxAge = 3600;

/// Secure storage that fails on every call, like a broken keychain or a key
/// the Android keystore can no longer unwrap.
class _BrokenStorage implements FlutterSecureStorage {
  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw Exception('keychain unavailable');
}

void main() {
  late Directory dir;
  const secure = FlutterSecureStorage();

  setUp(() {
    dir = Directory.systemTemp.createTempSync('session_store');
    FlutterSecureStorage.setMockInitialValues({});
  });

  tearDown(() => dir.deleteSync(recursive: true));

  Future<void> writeLegacyCookie(String value) async {
    final legacy = PersistCookieJar(
      storage: FileStorage('${dir.path}/.cookies'),
      ignoreExpires: false,
    );
    await legacy.saveFromResponse(_base, [_session(value)]);
  }

  test('a session survives reopening, held only in secure storage', () async {
    final jar = await openSessionCookieJar(dir.path, secure: secure);
    await jar.saveFromResponse(_base, [_session('abc')]);

    final reopened = await openSessionCookieJar(dir.path, secure: secure);
    final cookies = await reopened.loadForRequest(_base);

    expect(cookies.single.value, 'abc');
    expect(await secure.read(key: 'session_cookies.${_base.host}'),
        contains('abc'));
    expect(Directory('${dir.path}/.cookies').existsSync(), isFalse);
  });

  test('migrates a plain-file session and deletes the file', () async {
    await writeLegacyCookie('legacy-token');
    expect(Directory('${dir.path}/.cookies').existsSync(), isTrue);

    final jar = await openSessionCookieJar(dir.path, secure: secure);
    final cookies = await jar.loadForRequest(_base);

    expect(cookies.single.name, kSessionCookieSecure);
    expect(cookies.single.value, 'legacy-token');
    expect(Directory('${dir.path}/.cookies').existsSync(), isFalse);
  });

  test('a corrupt plain-file session means re-login, not a crash', () async {
    await writeLegacyCookie('legacy-token');
    final files = Directory('${dir.path}/.cookies')
        .listSync(recursive: true)
        .whereType<File>();
    for (final file in files) {
      file.writeAsStringSync('{not json');
    }

    final jar = await openSessionCookieJar(dir.path, secure: secure);

    expect(await jar.loadForRequest(_base), isEmpty);
    expect(Directory('${dir.path}/.cookies').existsSync(), isFalse);
  });

  test('corrupt secure data means re-login, not a crash', () async {
    await openSessionCookieJar(dir.path, secure: secure);
    await secure.write(
      key: 'session_cookies..index',
      value: '["${_base.host}"]',
    );
    await secure.write(
      key: 'session_cookies.${_base.host}',
      value: '{not json',
    );

    final jar = await openSessionCookieJar(dir.path, secure: secure);

    expect(await jar.loadForRequest(_base), isEmpty);
  });

  test('a broken keychain means re-login, not a crash', () async {
    await writeLegacyCookie('legacy-token');

    final jar = await openSessionCookieJar(dir.path, secure: _BrokenStorage());

    expect(await jar.loadForRequest(_base), isA<List<Cookie>>());
    // Nothing is left in plain text even though the move failed.
    expect(Directory('${dir.path}/.cookies').existsSync(), isFalse);
  });

  test('a keychain entry left by an uninstalled copy is discarded', () async {
    // iOS keeps keychain items across uninstall, while the app's files go.
    final jar = await openSessionCookieJar(dir.path, secure: secure);
    await jar.saveFromResponse(_base, [_session('old-install')]);
    for (final entry in dir.listSync()) {
      entry.deleteSync(recursive: true);
    }

    final fresh = await openSessionCookieJar(dir.path, secure: secure);

    expect(await fresh.loadForRequest(_base), isEmpty);
  });

  test('sign-out empties secure storage', () async {
    final jar = await openSessionCookieJar(dir.path, secure: secure);
    await jar.saveFromResponse(_base, [_session('abc')]);

    await jar.deleteAll();

    expect(await secure.read(key: 'session_cookies.${_base.host}'), isNull);
  });
}
