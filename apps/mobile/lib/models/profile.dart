/// A row from `GET /api/profiles` (browse) or `GET /api/profiles/:publicId`.
///
/// `firstName`, `city` and `state` arrive as null when the owner set
/// hideName / hideLocation — always render defensively.
class ProfileSummary {
  ProfileSummary({
    required this.publicId,
    required this.firstName,
    required this.age,
    required this.gender,
    required this.ethnicity,
    required this.city,
    required this.state,
    required this.avatarUrl,
    required this.bio,
    required this.membershipTier,
  });

  final String publicId;
  final String? firstName;
  final int age;
  final String gender;
  final String ethnicity;
  final String? city;
  final String? state;
  final String avatarUrl;
  final String? bio;
  final String membershipTier;

  /// Anonymised profiles fall back to the public id.
  String get displayName => firstName ?? publicId;
  bool get isAnonymous => firstName == null;

  String get location =>
      [city, state].where((e) => e != null && e.isNotEmpty).join(', ');

  factory ProfileSummary.fromJson(Map<String, dynamic> json) => ProfileSummary(
        publicId: json['publicId'] as String,
        firstName: json['firstName'] as String?,
        age: (json['age'] as num?)?.toInt() ?? 0,
        gender: json['gender'] as String? ?? '',
        ethnicity: json['ethnicity'] as String? ?? '',
        city: json['city'] as String?,
        state: json['state'] as String?,
        avatarUrl: json['avatarUrl'] as String? ?? '',
        bio: json['bio'] as String?,
        membershipTier: json['membershipTier'] as String? ?? 'FREE',
      );
}

class BrowsePage {
  BrowsePage({required this.items, required this.page, required this.pages});

  final List<ProfileSummary> items;
  final int page;
  final int pages;

  bool get hasMore => page < pages;

  factory BrowsePage.fromJson(Map<String, dynamic> json) {
    final data = (json['data'] as List?) ?? const [];
    final meta = (json['meta'] as Map?)?.cast<String, dynamic>() ?? const {};
    return BrowsePage(
      items: data
          .map((e) => ProfileSummary.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
      page: (meta['page'] as num?)?.toInt() ?? 1,
      pages: (meta['pages'] as num?)?.toInt() ?? 1,
    );
  }
}

/// `GET /api/profiles/me` — the owner's own record. Unlike the public views,
/// nothing here is masked.
class MyProfile {
  MyProfile({
    required this.id,
    required this.publicId,
    required this.email,
    required this.phone,
    required this.membershipTier,
    required this.isVerified,
    required this.image,
    required this.profile,
  });

  final String id;
  final String publicId;
  final String email;
  final String? phone;
  final String membershipTier;
  final bool isVerified;
  final String? image;
  final ProfileDetails? profile;

  bool get isComplete => profile?.profileComplete ?? false;

  factory MyProfile.fromJson(Map<String, dynamic> json) => MyProfile(
        id: json['id'] as String? ?? '',
        publicId: json['publicId'] as String? ?? '',
        email: json['email'] as String? ?? '',
        phone: json['phone'] as String?,
        membershipTier: json['membershipTier'] as String? ?? 'FREE',
        isVerified: json['isVerified'] as bool? ?? false,
        image: json['image'] as String?,
        profile: json['profile'] == null
            ? null
            : ProfileDetails.fromJson(
                (json['profile'] as Map).cast<String, dynamic>()),
      );
}

class ProfileDetails {
  ProfileDetails({
    required this.firstName,
    required this.lastName,
    required this.dob,
    required this.age,
    required this.gender,
    required this.ethnicity,
    required this.city,
    required this.state,
    required this.bio,
    required this.biodata,
    required this.profileComplete,
  });

  final String firstName;
  final String lastName;
  final String? dob;
  final int age;
  final String? gender;
  final String ethnicity;
  final String? city;
  final String? state;
  final String? bio;

  /// Free-form encrypted blob on the server. Holds the wizard's extra fields
  /// plus guardian details captured at signup — never drop unknown keys when
  /// writing back, the API replaces the whole blob on every save.
  final Map<String, dynamic> biodata;

  final bool profileComplete;

  factory ProfileDetails.fromJson(Map<String, dynamic> json) => ProfileDetails(
        firstName: json['firstName'] as String? ?? '',
        lastName: json['lastName'] as String? ?? '',
        dob: json['dob'] as String?,
        age: (json['age'] as num?)?.toInt() ?? 0,
        gender: json['gender'] as String?,
        ethnicity: json['ethnicity'] as String? ?? '',
        city: json['city'] as String?,
        state: json['state'] as String?,
        bio: json['bio'] as String?,
        biodata: (json['biodata'] as Map?)?.cast<String, dynamic>() ?? {},
        profileComplete: json['profileComplete'] as bool? ?? false,
      );
}
