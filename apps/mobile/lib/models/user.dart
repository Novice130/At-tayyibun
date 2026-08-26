/// The `user` object returned by better-auth on sign-in and get-session.
/// `publicId`, `role`, `emailIsPlaceholder` and `phoneGateExempt` are declared
/// additionalFields on the server; `phoneNumber` and `phoneNumberVerified`
/// belong to the phone-number plugin and map to users.phone / is_phone_verified.
class AppUser {
  AppUser({
    required this.id,
    required this.email,
    required this.name,
    required this.image,
    required this.emailVerified,
    required this.publicId,
    required this.role,
    required this.phoneNumber,
    required this.phoneNumberVerified,
    required this.phoneGateExempt,
    required this.emailIsPlaceholder,
  });

  final String id;
  final String email;
  final String? name;
  final String? image;
  final bool emailVerified;
  final String? publicId;
  final String role;
  final String? phoneNumber;
  final bool phoneNumberVerified;
  final bool phoneGateExempt;
  final bool emailIsPlaceholder;

  bool get isAdmin => role == 'ADMIN' || role == 'SUPER_ADMIN';

  /// Blocked at the phone gate. Accounts created before phone verification
  /// existed are exempt, so nobody who already signed up is locked out.
  bool get needsPhone => !phoneNumberVerified && !phoneGateExempt;

  /// True when the user has picked one of the curated illustrated avatars
  /// (/avatars/male/... or /avatars/female/...). Google/Apple default profile pictures
  /// or null/empty images do not count as preset avatars.
  bool get hasPresetAvatar =>
      image != null &&
      image!.isNotEmpty &&
      (image!.contains('/avatars/male/') || image!.contains('/avatars/female/'));

  /// Needs to select an avatar right after signup/sign-in.
  bool get needsAvatar => !hasPresetAvatar;

  /// Phone-first signups hold a `+<e164>@phone.attayyibun.invalid` address
  /// until the profile wizard collects a real one.
  bool get needsEmail => emailIsPlaceholder;

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as String? ?? '',
        email: json['email'] as String? ?? '',
        name: json['name'] as String?,
        image: json['image'] as String?,
        emailVerified: json['emailVerified'] as bool? ?? false,
        publicId: json['publicId'] as String?,
        role: json['role'] as String? ?? 'USER',
        // `phone` is the API's /session/me spelling; better-auth returns the
        // plugin's model field name.
        phoneNumber: json['phoneNumber'] as String? ?? json['phone'] as String?,
        phoneNumberVerified:
            json['phoneNumberVerified'] as bool? ?? json['isPhoneVerified'] as bool? ?? false,
        phoneGateExempt: json['phoneGateExempt'] as bool? ?? false,
        emailIsPlaceholder: json['emailIsPlaceholder'] as bool? ?? false,
      );
}
