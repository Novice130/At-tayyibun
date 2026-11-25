import 'dart:async';
import 'dart:convert';

import 'package:at_tayyibun/core/push_notifications.dart';
import 'package:at_tayyibun/repositories/devices_repository.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fake_api.dart';

class _FakeMessaging implements PushMessaging {
  bool permission = true;
  int permissionRequests = 0;
  String? token = 'tok-1';
  Map<String, dynamic>? initialData;
  final refresh = StreamController<String>.broadcast();
  final opened = StreamController<Map<String, dynamic>>.broadcast();
  final foreground = StreamController<void>.broadcast();

  @override
  Future<bool> requestPermission() async {
    permissionRequests++;
    return permission;
  }

  @override
  Future<bool> hasPermission() async => permission;

  @override
  Future<String?> getToken() async => token;

  @override
  Stream<String> get onTokenRefresh => refresh.stream;

  @override
  Future<Map<String, dynamic>?> initialMessageData() async => initialData;

  @override
  Stream<Map<String, dynamic>> get onMessageOpenedApp => opened.stream;

  @override
  Stream<void> get onForegroundMessage => foreground.stream;
}

/// Registers normally; unregister never answers.
class _HungDevices implements DevicesRepository {
  _HungDevices(this._inner);
  final DevicesRepository _inner;

  @override
  Future<void> register(String token, String platform) =>
      _inner.register(token, platform);

  @override
  Future<void> unregister(String token) => Completer<void>().future;
}

/// Each request the fake API saw: method, path and decoded JSON body.
typedef _Call = ({String method, String path, Map<String, dynamic> body});

void main() {
  late _FakeMessaging messaging;
  late List<_Call> calls;
  late PushNotifications push;
  late DevicesRepository devices;
  int failWith = 0;

  setUp(() {
    messaging = _FakeMessaging();
    calls = [];
    failWith = 0;
    final api = fakeApiClient((RequestOptions o) async {
      final data = o.data;
      calls.add((
        method: o.method,
        path: o.path,
        body: data is String
            ? (jsonDecode(data) as Map<String, dynamic>)
            : Map<String, dynamic>.from(data as Map),
      ));
      if (failWith != 0) return jsonBody({'message': 'nope'}, status: failWith);
      return jsonBody({'success': true});
    });
    devices = DevicesRepository(api);
    push = PushNotifications(
      messaging: messaging,
      devices: devices,
      platform: 'android',
    );
  });

  test('start asks permission, then registers the token with the platform',
      () async {
    await push.start();

    expect(messaging.permissionRequests, 1);
    expect(calls, hasLength(1));
    expect(calls.single.method, 'POST');
    expect(calls.single.path, '/api/devices');
    expect(calls.single.body, {'token': 'tok-1', 'platform': 'android'});
    expect(push.registeredToken, 'tok-1');
  });

  test('start is idempotent while active', () async {
    await push.start();
    await push.start();
    expect(messaging.permissionRequests, 1);
    expect(calls, hasLength(1));
  });

  test('a denied permission registers nothing', () async {
    messaging.permission = false;
    await push.start();
    expect(calls, isEmpty);
    expect(push.registeredToken, isNull);
  });

  test('a refreshed token is registered too', () async {
    await push.start();
    messaging.refresh.add('tok-2');
    await pumpEventQueue();

    expect(calls.map((c) => c.body['token']), ['tok-1', 'tok-2']);
    expect(push.registeredToken, 'tok-2');
  });

  test('stop unregisters the token and ignores later refreshes', () async {
    await push.start();
    await push.stop();
    messaging.refresh.add('tok-3');
    await pumpEventQueue();

    expect(calls.last.method, 'POST');
    expect(calls.last.path, '/api/devices/unregister');
    expect(calls.last.body, {'token': 'tok-1'});
    expect(calls, hasLength(2));
    expect(push.registeredToken, isNull);
  });

  test('stop without a remembered token removes the current one', () async {
    // Launched offline, then signed out: start() never ran this launch.
    await push.stop();
    expect(calls.single.path, '/api/devices/unregister');
    expect(calls.single.body, {'token': 'tok-1'});
  });

  test('stop makes no request when notifications were never allowed',
      () async {
    messaging.permission = false;
    await push.stop();
    expect(calls, isEmpty);
  });

  test('reset stops without calling the server but keeps the token',
      () async {
    await push.start();
    await push.reset();
    expect(calls, hasLength(1));
    expect(push.registeredToken, 'tok-1');

    // Signed out later from the offline screen, with a session again.
    await push.stop();
    expect(calls.last.path, '/api/devices/unregister');
    expect(calls.last.body, {'token': 'tok-1'});
  });

  test('a denied permission can be retried later without a prompt', () async {
    messaging.permission = false;
    await push.start();
    expect(calls, isEmpty);

    // Turned on in Settings; the app comes back to the foreground.
    messaging.permission = true;
    await push.start(prompt: false);
    expect(messaging.permissionRequests, 1);
    expect(calls.single.body, {'token': 'tok-1', 'platform': 'android'});
  });

  test('a late APNs token is registered on a later start', () async {
    messaging.token = null;
    await push.start();
    expect(calls, isEmpty);

    messaging.token = 'tok-late';
    await push.start(prompt: false);
    expect(push.registeredToken, 'tok-late');
  });

  test('start(prompt: false) never shows the permission prompt', () async {
    await push.start(prompt: false);
    expect(messaging.permissionRequests, 0);
    expect(push.registeredToken, 'tok-1');
  });

  test('stop gives up on a hung unregister call', () async {
    final hung = PushNotifications(
      messaging: messaging,
      devices: _HungDevices(devices),
      platform: 'android',
      unregisterTimeout: const Duration(milliseconds: 50),
    );
    await hung.start();
    await expectLater(
      hung.stop().timeout(const Duration(seconds: 2)),
      completes,
    );
  });

  test('API failures never throw out of start or stop', () async {
    failWith = 500;
    await expectLater(push.start(), completes);
    expect(push.registeredToken, isNull);
    await expectLater(push.stop(), completes);
  });

  test('a missing token (APNs not ready) registers nothing', () async {
    messaging.token = null;
    await push.start();
    expect(calls, isEmpty);
  });

  test('the launching notification is answered once, as an app location',
      () async {
    messaging.initialData = {'path': '/requests'};
    expect(await push.takeInitialLocation(), '/requests');
    expect(await push.takeInitialLocation(), isNull);
  });

  test('a launching notification with an unknown path is ignored', () async {
    messaging.initialData = {'path': '/admin'};
    expect(await push.takeInitialLocation(), isNull);
  });

  test('taps map to locations and unknown paths are dropped', () async {
    final seen = <String>[];
    final sub = push.tappedLocations.listen(seen.add);
    messaging.opened
      ..add({'path': '/requests'})
      ..add({'path': 'https://evil.example/x'})
      ..add({'path': '/profiles/abc'});
    await pumpEventQueue();
    await sub.cancel();

    expect(seen, ['/requests', '/profiles/abc']);
  });
}
