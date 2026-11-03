import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../repositories/devices_repository.dart';
import 'deep_links.dart';

/// The parts of Firebase Cloud Messaging the app uses, behind an interface so
/// the registration logic can be tested without Firebase.
abstract class PushMessaging {
  /// Shows the system prompt the first time. True if notifications may show.
  Future<bool> requestPermission();

  /// Whether notifications may show, without ever prompting.
  Future<bool> hasPermission();

  Future<String?> getToken();

  Stream<String> get onTokenRefresh;

  /// `data` of the notification whose tap launched the app, if any.
  Future<Map<String, dynamic>?> initialMessageData();

  /// `data` of each notification tapped while the app was in the background.
  Stream<Map<String, dynamic>> get onMessageOpenedApp;

  /// Fires for each push received while the app is in the foreground.
  Stream<void> get onForegroundMessage;
}

class FirebasePushMessaging implements PushMessaging {
  FirebaseMessaging get _fcm => FirebaseMessaging.instance;

  @override
  Future<bool> requestPermission() async {
    final settings = await _fcm.requestPermission();
    // iOS hides a push that arrives while the app is open unless told not to.
    // Android ignores this; there the foreground listener refreshes lists.
    await _fcm.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );
    return _allowed(settings.authorizationStatus);
  }

  @override
  Future<bool> hasPermission() async =>
      _allowed((await _fcm.getNotificationSettings()).authorizationStatus);

  static bool _allowed(AuthorizationStatus status) =>
      status == AuthorizationStatus.authorized ||
      status == AuthorizationStatus.provisional;

  @override
  Future<String?> getToken() async {
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      // On iOS the FCM token needs the APNs token, which can arrive a moment
      // after permission is granted. Without it getToken throws.
      for (var i = 0; i < 5; i++) {
        if (await _fcm.getAPNSToken() != null) break;
        await Future<void>.delayed(const Duration(seconds: 1));
      }
      if (await _fcm.getAPNSToken() == null) return null;
    }
    return _fcm.getToken();
  }

  @override
  Stream<String> get onTokenRefresh => _fcm.onTokenRefresh;

  @override
  Future<Map<String, dynamic>?> initialMessageData() async =>
      (await _fcm.getInitialMessage())?.data;

  @override
  Stream<Map<String, dynamic>> get onMessageOpenedApp =>
      FirebaseMessaging.onMessageOpenedApp.map((m) => m.data);

  @override
  Stream<void> get onForegroundMessage => FirebaseMessaging.onMessage;
}

/// Registers this device for push while a member is signed in, and turns
/// notification taps into in-app locations.
///
/// Nothing here throws: push is a convenience, so any failure is logged (by
/// type only) and the app carries on.
class PushNotifications {
  PushNotifications({
    required this._messaging,
    required this._devices,
    required this._platform,
    this._unregisterTimeout = const Duration(seconds: 3),
  });

  final PushMessaging _messaging;
  final DevicesRepository _devices;
  final String _platform;

  /// Sign-out waits for the unregister call; it must not hang on a bad network.
  final Duration _unregisterTimeout;

  bool _active = false;
  String? _registeredToken;
  StreamSubscription<String>? _refreshSub;
  bool _initialMessageHandled = false;

  /// The token the server currently has for this device, if any.
  @visibleForTesting
  String? get registeredToken => _registeredToken;

  /// Call once a member is signed in (past the phone gate, which the API
  /// enforces on every route). Asks for permission (only checks it when
  /// [prompt] is false), registers the token and follows token refreshes.
  ///
  /// Once a token is registered, repeated calls are ignored until [stop] or
  /// [reset]. If nothing was registered (permission denied, the iOS APNs
  /// token not ready yet, a network error), a later call tries again: the app
  /// calls `start(prompt: false)` each time it returns to the foreground, so
  /// turning notifications on in Settings takes effect without signing out.
  Future<void> start({bool prompt = true}) async {
    if (_active) return;
    _active = true;
    var registered = false;
    try {
      final allowed = prompt
          ? await _messaging.requestPermission()
          : await _messaging.hasPermission();
      if (allowed && _active) {
        _refreshSub ??= _messaging.onTokenRefresh.listen(_register);
        final token = await _messaging.getToken();
        if (token != null) {
          await _register(token);
          registered = _registeredToken == token;
        }
      }
    } catch (e) {
      debugPrint('[push] start failed: ${e.runtimeType}');
    }
    if (!registered && _active) {
      _active = false;
      await _refreshSub?.cancel();
      _refreshSub = null;
    }
  }

  Future<void> _register(String token) async {
    if (!_active) return;
    try {
      await _devices.register(token, _platform);
      _registeredToken = token;
      // Signed out while the request was in flight: take it back.
      if (!_active) await _unregister();
    } catch (e) {
      debugPrint('[push] register failed: ${e.runtimeType}');
    }
  }

  /// Stops following refreshes and removes this device's token from the
  /// server. Needs the session, so the sign-out flow calls it first. Gives up
  /// after a few seconds so sign-out never hangs on a bad network.
  ///
  /// With no token remembered (say the app was launched offline and the
  /// member signs out from there), it removes the device's current FCM token,
  /// if notifications were ever allowed. The server only deletes the caller's
  /// own tokens, so this is harmless when the token belongs to nobody.
  Future<void> stop() async {
    _active = false;
    await _refreshSub?.cancel();
    _refreshSub = null;
    try {
      await _unregister().timeout(_unregisterTimeout);
    } on TimeoutException {
      debugPrint('[push] unregister timed out');
    }
  }

  Future<void> _unregister() async {
    var token = _registeredToken;
    _registeredToken = null;
    try {
      if (token == null && await _messaging.hasPermission()) {
        token = await _messaging.getToken();
      }
      if (token == null) return;
      await _devices.unregister(token);
    } catch (e) {
      debugPrint('[push] unregister failed: ${e.runtimeType}');
    }
  }

  /// Stops without calling the server, for when the session may be gone
  /// (account deleted, suspended, expired, or the server unreachable). The
  /// last registered token is kept, so a sign-out that still has a session
  /// (from the offline screen, say) can remove it. The server removes a
  /// deleted account's tokens itself and does not push to suspended ones.
  Future<void> reset() async {
    _active = false;
    await _refreshSub?.cancel();
    _refreshSub = null;
  }

  /// Where the notification that launched the app points. Answers once per
  /// launch, so signing out and in again does not reopen it.
  Future<String?> takeInitialLocation() async {
    if (_initialMessageHandled) return null;
    _initialMessageHandled = true;
    try {
      final data = await _messaging.initialMessageData();
      return data == null ? null : pushLocation(data);
    } catch (e) {
      debugPrint('[push] initial message failed: ${e.runtimeType}');
      return null;
    }
  }

  /// Locations of notifications tapped while the app was in the background.
  Stream<String> get tappedLocations => _messaging.onMessageOpenedApp
      .map(pushLocation)
      .where((l) => l != null)
      .cast<String>();

  Stream<void> get foregroundMessages => _messaging.onForegroundMessage;
}
