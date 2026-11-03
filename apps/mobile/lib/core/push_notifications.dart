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
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

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
  });

  final PushMessaging _messaging;
  final DevicesRepository _devices;
  final String _platform;

  bool _active = false;
  String? _registeredToken;
  StreamSubscription<String>? _refreshSub;
  bool _initialMessageHandled = false;

  /// The token the server currently has for this device, if any.
  @visibleForTesting
  String? get registeredToken => _registeredToken;

  /// Call once a member is signed in (past the phone gate, which the API
  /// enforces on every route). Asks for permission, registers the token and
  /// follows token refreshes. Repeated calls are ignored until [stop].
  Future<void> start() async {
    if (_active) return;
    _active = true;
    try {
      if (!await _messaging.requestPermission()) return;
      if (!_active) return;
      _refreshSub = _messaging.onTokenRefresh.listen(_register);
      final token = await _messaging.getToken();
      if (token != null) await _register(token);
    } catch (e) {
      debugPrint('[push] start failed: ${e.runtimeType}');
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
  /// server. Needs the session, so the sign-out flow calls it first.
  Future<void> stop() async {
    _active = false;
    await _refreshSub?.cancel();
    _refreshSub = null;
    await _unregister();
  }

  Future<void> _unregister() async {
    final token = _registeredToken;
    _registeredToken = null;
    if (token == null) return;
    try {
      await _devices.unregister(token);
    } catch (e) {
      debugPrint('[push] unregister failed: ${e.runtimeType}');
    }
  }

  /// Forgets local state without calling the server, for when the session is
  /// already gone (account deleted, suspended, expired). The server removes
  /// a deleted account's tokens itself and does not push to suspended ones.
  Future<void> reset() async {
    _active = false;
    await _refreshSub?.cancel();
    _refreshSub = null;
    _registeredToken = null;
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
