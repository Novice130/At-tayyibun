import '../core/api_client.dart';

/// This device's push token on the server, so request notifications reach it.
class DevicesRepository {
  DevicesRepository(this._api);

  final ApiClient _api;

  /// [platform] is `android` or `ios`. Safe to repeat: the server upserts.
  Future<void> register(String token, String platform) => _api.post<dynamic>(
        '/api/devices',
        body: {'token': token, 'platform': platform},
      );

  /// Needs the session, so call it before signing out.
  Future<void> unregister(String token) => _api.post<dynamic>(
        '/api/devices/unregister',
        body: {'token': token},
      );
}
