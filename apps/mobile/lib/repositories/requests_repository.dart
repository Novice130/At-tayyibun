import '../core/api_client.dart';
import '../models/info_request.dart';

class RequestsRepository {
  RequestsRepository(this._api);

  final ApiClient _api;

  /// Throws ApiException with statusCode 409 when a pending request already
  /// exists — the caller should offer to cancel it.
  Future<void> send(String targetPublicId) async {
    await _api.post<dynamic>(
      '/api/requests',
      body: {'targetPublicId': targetPublicId},
    );
  }

  /// The caller's single outstanding outgoing request, or null.
  Future<InfoRequest?> active() async {
    final data = await _api.get<dynamic>('/api/requests/active');
    if (data is! Map) return null;
    return InfoRequest.fromJson(data.cast<String, dynamic>(), partyKey: 'target');
  }

  Future<List<InfoRequest>> incoming() => _list('incoming', 'requester');

  Future<List<InfoRequest>> outgoing() => _list('outgoing', 'target');

  Future<void> respond(String id, {required bool approved}) async {
    await _api.put<dynamic>(
      '/api/requests/$id/respond',
      body: {
        'approved': approved,
        // Matches the website: approving shares phone + email.
        if (approved) 'shareItems': const ['phone', 'email'],
      },
    );
  }

  /// Withdraw an outgoing pending request. Hard-deletes the row server-side,
  /// which frees the one-pending-request slot immediately.
  Future<void> cancel(String id) async {
    await _api.delete<dynamic>('/api/requests/$id');
  }

  Future<List<InfoRequest>> _list(String path, String partyKey) async {
    final data = await _api.get<dynamic>('/api/requests/$path');
    if (data is! List) return const [];
    return data
        .map((e) => InfoRequest.fromJson(
              (e as Map).cast<String, dynamic>(),
              partyKey: partyKey,
            ))
        .toList();
  }
}
