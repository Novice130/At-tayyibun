import '../core/api_client.dart';
import '../core/constants.dart';
import '../models/profile.dart';

class BrowseFilters {
  const BrowseFilters({
    this.gender,
    this.ethnicity,
    this.minAge,
    this.maxAge,
    this.sortBy,
    this.order,
  });

  final String? gender;
  final String? ethnicity;
  final int? minAge;
  final int? maxAge;
  final String? sortBy;
  final String? order;

  BrowseFilters copyWith({
    Object? gender = _sentinel,
    Object? ethnicity = _sentinel,
    Object? minAge = _sentinel,
    Object? maxAge = _sentinel,
    Object? sortBy = _sentinel,
    Object? order = _sentinel,
  }) =>
      BrowseFilters(
        gender: gender == _sentinel ? this.gender : gender as String?,
        ethnicity: ethnicity == _sentinel ? this.ethnicity : ethnicity as String?,
        minAge: minAge == _sentinel ? this.minAge : minAge as int?,
        maxAge: maxAge == _sentinel ? this.maxAge : maxAge as int?,
        sortBy: sortBy == _sentinel ? this.sortBy : sortBy as String?,
        order: order == _sentinel ? this.order : order as String?,
      );

  static const _sentinel = Object();
}

class ProfilesRepository {
  ProfilesRepository(this._api);

  final ApiClient _api;

  Future<BrowsePage> browse({
    required BrowseFilters filters,
    int page = 1,
  }) async {
    final data = await _api.get<Map<String, dynamic>>(
      '/api/profiles',
      query: {
        'page': page,
        'limit': kBrowsePageSize,
        if (filters.gender != null) 'gender': filters.gender,
        if (filters.ethnicity != null && filters.ethnicity!.isNotEmpty) 'ethnicity': filters.ethnicity,
        if (filters.minAge != null) 'minAge': filters.minAge,
        if (filters.maxAge != null) 'maxAge': filters.maxAge,
        if (filters.sortBy != null) 'sortBy': filters.sortBy,
        if (filters.order != null) 'order': filters.order,
      },
    );
    return BrowsePage.fromJson(data);
  }

  Future<MyProfile> me() async {
    final data = await _api.get<Map<String, dynamic>>('/api/profiles/me');
    return MyProfile.fromJson(data);
  }

  Future<ProfileSummary> byPublicId(String publicId) async {
    final data = await _api.get<Map<String, dynamic>>('/api/profiles/$publicId');
    return ProfileSummary.fromJson(data);
  }

  /// Partial update. The server runs `forbidNonWhitelisted`, so only the nine
  /// declared DTO fields may be sent — anything else is a 400.
  Future<MyProfile> update({
    String? firstName,
    String? lastName,
    String? dob,
    String? gender,
    String? ethnicity,
    String? city,
    String? state,
    String? bio,
    Map<String, dynamic>? biodata,
  }) async {
    final data = await _api.put<Map<String, dynamic>>(
      '/api/profiles/me',
      body: {
        'firstName': ?firstName,
        'lastName': ?lastName,
        'dob': ?dob,
        'gender': ?gender,
        'ethnicity': ?ethnicity,
        'city': ?city,
        'state': ?state,
        'bio': ?bio,
        'biodata': ?biodata,
      },
    );
    return MyProfile.fromJson(data);
  }
}
