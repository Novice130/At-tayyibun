/// The `user` object returned by better-auth on sign-in and get-session.
/// `publicId`, `role` and `phone` are declared additionalFields on the server.
class AppUser {
  AppUser({
    required this.id,
    required this.email,
    required this.name,
    required this.image,
    required this.emailVerified,
    required this.publicId,
    required this.role,
    required this.phone,
  });

  final String id;
  final String email;
  final String? name;
  final String? image;
  final bool emailVerified;
  final String? publicId;
  final String role;
  final String? phone;

  bool get isAdmin => role == 'ADMIN' || role == 'SUPER_ADMIN';

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as String? ?? '',
        email: json['email'] as String? ?? '',
        name: json['name'] as String?,
        image: json['image'] as String?,
        emailVerified: json['emailVerified'] as bool? ?? false,
        publicId: json['publicId'] as String?,
        role: json['role'] as String? ?? 'USER',
        phone: json['phone'] as String?,
      );
}
