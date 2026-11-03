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

/// Each request the fake API saw: method, path and decoded JSON body.
typedef _Call = ({String method, String path, Map<String, dynamic> body});

void main() {
  late _FakeMessaging messaging;
  late List<_Call> calls;
  late PushNotifications push;
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
    push = PushNotifications(
      messaging: messaging,
      devices: DevicesRepository(api),
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

  test('stop without a registered token makes no request', () async {
    await push.stop();
    expect(calls, isEmpty);
  });

  test('reset forgets the token without calling the server', () async {
    await push.start();
    await push.reset();
    expect(calls, hasLength(1));
    expect(push.registeredToken, isNull);
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
