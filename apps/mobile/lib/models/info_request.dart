/// A contact request. The list endpoints return the raw `info_requests` row
/// plus one nested counterparty (`requester` on incoming, `target` on outgoing).
class InfoRequest {
  InfoRequest({
    required this.id,
    required this.status,
    required this.createdAt,
    required this.expiresAt,
    required this.counterpart,
  });

  final String id;
  final String status;
  final DateTime? createdAt;
  final DateTime? expiresAt;

  /// `requester` for incoming, `target` for outgoing. Null if the row's
  /// counterparty has no profile yet.
  final RequestParty? counterpart;

  bool get isPending => status == 'PENDING';

  factory InfoRequest.fromJson(Map<String, dynamic> json, {required String partyKey}) {
    final party = json[partyKey];
    return InfoRequest(
      id: json['id'] as String,
      status: json['status'] as String? ?? 'PENDING',
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
      expiresAt: DateTime.tryParse(json['expiresAt']?.toString() ?? ''),
      counterpart: party == null
          ? null
          : RequestParty.fromJson((party as Map).cast<String, dynamic>()),
    );
  }
}

class RequestParty {
  RequestParty({
    required this.publicId,
    required this.firstName,
    required this.ethnicity,
    required this.city,
    required this.state,
  });

  final String publicId;
  final String? firstName;
  final String? ethnicity;
  final String? city;
  final String? state;

  String get displayName => firstName ?? publicId;

  String get location =>
      [city, state].where((e) => e != null && e.isNotEmpty).join(', ');

  factory RequestParty.fromJson(Map<String, dynamic> json) {
    final profile = (json['profile'] as Map?)?.cast<String, dynamic>();
    return RequestParty(
      publicId: json['publicId'] as String? ?? '',
      firstName: profile?['firstName'] as String?,
      ethnicity: profile?['ethnicity'] as String?,
      city: profile?['city'] as String?,
      state: profile?['state'] as String?,
    );
  }
}
