/// A contact request. The list endpoints return the raw `info_requests` row
/// plus one nested counterparty (`requester` on incoming, `target` on outgoing).
class InfoRequest {
  InfoRequest({
    required this.id,
    required this.status,
    required this.createdAt,
    required this.expiresAt,
    required this.counterpart,
    this.contactState,
  });

  /// AVAILABLE, VIEWED, EXPIRED or EMAILED on an approved outgoing request.
  final String? contactState;

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
      contactState: json['contactState'] as String?,
      counterpart: party == null
          ? null
          : RequestParty.fromJson((party as Map).cast<String, dynamic>()),
    );
  }
}

/// What an approver chose to share. Shown once and never stored on the device.
class SharedContact {
  SharedContact({this.name, this.phone, this.email});

  final String? name;
  final String? phone;
  final String? email;

  factory SharedContact.fromJson(Map<String, dynamic> json) => SharedContact(
        name: json['name'] as String?,
        phone: json['phone'] as String?,
        email: json['email'] as String?,
      );
}

class RequestParty {
  RequestParty({
    required this.publicId,
    required this.firstName,
    required this.ethnicity,
    required this.city,
    required this.state,
    this.maritalStatus,
    this.hasChildren,
    this.childrenCount,
  });

  final String? maritalStatus;
  final bool? hasChildren;
  final int? childrenCount;

  final String publicId;
  final String? firstName;
  final String? ethnicity;
  final String? city;
  final String? state;

  String get displayName => firstName ?? 'Member';

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
      maritalStatus: profile?['maritalStatus'] as String?,
      hasChildren: profile?['hasChildren'] as bool?,
      childrenCount: (profile?['childrenCount'] as num?)?.toInt(),
    );
  }
}
