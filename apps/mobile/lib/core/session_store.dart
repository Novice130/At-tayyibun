import 'dart:io' show Directory, File;

import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'constants.dart';

/// Keychain items marked "this device only" are left out of iCloud and of
/// backups restored to another device. Android keeps them in app preferences
/// encrypted by a Keystore key, and backup is turned off in the manifest.
const FlutterSecureStorage kSessionSecureStorage = FlutterSecureStorage(
  iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
);

const _keyPrefix = 'session_cookies.';
const _legacyDirName = '.cookies';
const _markerName = '.session-store-v1';

/// Holds the cookie jar's data in secure storage instead of files.
///
/// A storage failure must never stop the app from opening, so every failure is
/// logged and treated as "nothing stored". The worst outcome is a re-login.
/// Cookie values are never logged.
class SecureCookieStorage implements Storage {
  const SecureCookieStorage(this._secure);

  final FlutterSecureStorage _secure;

  @override
  Future<void> init(bool persistSession, bool ignoreExpires) async {}

  @override
  Future<String?> read(String key) async {
    try {
      return await _secure.read(key: '$_keyPrefix$key');
    } catch (e) {
      debugPrint('[session_store] read failed: ${e.runtimeType}');
      return null;
    }
  }

  @override
  Future<void> write(String key, String value) async {
    try {
      await _secure.write(key: '$_keyPrefix$key', value: value);
    } catch (e) {
      debugPrint('[session_store] write failed: ${e.runtimeType}');
    }
  }

  @override
  Future<void> delete(String key) async {
    try {
      await _secure.delete(key: '$_keyPrefix$key');
    } catch (e) {
      debugPrint('[session_store] delete failed: ${e.runtimeType}');
    }
  }

  @override
  Future<void> deleteAll(List<String> keys) async {
    for (final key in keys) {
      await delete(key);
    }
  }
}

/// Opens the session cookie jar. Never throws.
///
/// Versions up to 0.1.4 kept the jar in plain files under [supportDir], where
/// backups could copy it. Those files are moved here once and then deleted,
/// even if the move fails: a re-login is better than a token left on disk.
///
/// The marker file tells a reinstall apart from a normal launch. iOS keeps
/// keychain items after an uninstall but removes the app's files, so a missing
/// marker means anything in the keychain belongs to an earlier install and
/// must not sign the new install in.
Future<PersistCookieJar> openSessionCookieJar(
  String supportDir, {
  FlutterSecureStorage secure = kSessionSecureStorage,
}) async {
  final marker = File('$supportDir/$_markerName');
  final legacy = Directory('$supportDir/$_legacyDirName');

  if (!await _exists(marker)) {
    try {
      await secure.deleteAll();
    } catch (e) {
      debugPrint('[session_store] clear failed: ${e.runtimeType}');
    }
  }

  final jar = PersistCookieJar(
    storage: SecureCookieStorage(secure),
    ignoreExpires: false,
  );
  final base = Uri.parse(kBaseUrl);

  if (await _exists(legacy)) {
    await _migrateLegacyCookies(legacy, jar, base);
  }

  try {
    await marker.create(recursive: true);
  } catch (e) {
    debugPrint('[session_store] marker failed: ${e.runtimeType}');
  }

  // Unreadable stored data would otherwise throw on the first request.
  try {
    await jar.loadForRequest(base);
  } catch (e) {
    debugPrint('[session_store] discarding unreadable session: ${e.runtimeType}');
    try {
      await jar.deleteAll();
    } catch (e) {
      debugPrint('[session_store] discard failed: ${e.runtimeType}');
    }
  }
  return jar;
}

Future<void> _migrateLegacyCookies(
  Directory legacy,
  PersistCookieJar jar,
  Uri base,
) async {
  try {
    final old = PersistCookieJar(
      storage: FileStorage(legacy.path),
      ignoreExpires: false,
    );
    final cookies = await old.loadForRequest(base);
    await jar.saveFromResponse(base, cookies);
  } catch (e) {
    debugPrint('[session_store] migration failed: ${e.runtimeType}');
  } finally {
    try {
      await legacy.delete(recursive: true);
    } catch (e) {
      debugPrint('[session_store] legacy delete failed: ${e.runtimeType}');
    }
  }
}

Future<bool> _exists(Object entity) async {
  try {
    return entity is File
        ? await entity.exists()
        : await (entity as Directory).exists();
  } catch (_) {
    return false;
  }
}
