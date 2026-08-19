import '../core/api_client.dart';

class BlockedUser {
  const BlockedUser({
    required this.targetPublicId,
    this.name,
    this.email,
  });

  final String targetPublicId;
  final String? name;
  final String? email;

  factory BlockedUser.fromJson(Map<String, dynamic> json) => BlockedUser(
        targetPublicId: json['targetPublicId'] as String,
        name: json['name'] as String?,
        email: json['email'] as String?,
      );
}

class ModerationRepository {
  ModerationRepository(this._api);

  final ApiClient _api;

  Future<void> block(String targetPublicId) =>
      _api.post<dynamic>('/api/blocks', body: {'targetPublicId': targetPublicId});

  Future<void> unblock(String targetPublicId) =>
      _api.delete<dynamic>('/api/blocks/$targetPublicId');

  Future<List<BlockedUser>> blocked() async {
    final data = await _api.get<dynamic>('/api/blocks');
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((e) => BlockedUser.fromJson(e.cast<String, dynamic>()))
        .toList();
  }

  Future<void> report(
    String targetPublicId, {
    required String reason,
    String? details,
  }) =>
      _api.post<dynamic>('/api/reports', body: {
        'targetPublicId': targetPublicId,
        'reason': reason,
        if (details != null && details.isNotEmpty) 'details': details,
      });
}
