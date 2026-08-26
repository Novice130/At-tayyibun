import 'dart:convert';
import 'dart:typed_data';

import 'package:at_tayyibun/core/api_client.dart';
import 'package:at_tayyibun/repositories/profiles_repository.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

class _MockHttpAdapter implements HttpClientAdapter {
  _MockHttpAdapter(this.handler);

  final Future<ResponseBody> Function(RequestOptions options) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    return handler(options);
  }

  @override
  void close({bool force = false}) {}
}

ApiClient _createTestApiClient(
  Future<ResponseBody> Function(RequestOptions options) handler,
) {
  final dio = Dio(
    BaseOptions(
      baseUrl: 'https://attayyibun.test',
      responseType: ResponseType.json,
    ),
  );
  dio.httpClientAdapter = _MockHttpAdapter(handler);
  return ApiClient.forTesting(dio);
}

ResponseBody _jsonResponse(dynamic data, {int statusCode = 200}) {
  final str = jsonEncode(data);
  return ResponseBody.fromString(
    str,
    statusCode,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}

void main() {
  group('ProfilesRepository browse filters', () {
    test('serializes ethnicity, age, sort and order correctly', () async {
      Map<String, dynamic>? capturedQuery;

      final api = _createTestApiClient((options) async {
        if (options.path == '/api/profiles') {
          capturedQuery = options.queryParameters;
          return _jsonResponse({
            'data': [
              {
                'publicId': 'usr_fem_1',
                'firstName': 'Fatima',
                'age': 26,
                'gender': 'FEMALE',
                'ethnicity': 'Arab',
                'city': 'Chicago',
                'state': 'IL',
                'avatarUrl': 'https://attayyibun.com/avatars/female/female-1.jpg',
                'bio': 'Practicing Muslimah.',
                'membershipTier': 'FREE',
              }
            ],
            'meta': {'total': 1, 'page': 1, 'limit': 20, 'pages': 1},
          });
        }
        return _jsonResponse({}, statusCode: 404);
      });

      final repo = ProfilesRepository(api);
      const filters = BrowseFilters(
        gender: 'FEMALE',
        ethnicity: 'Arab',
        minAge: 22,
        maxAge: 30,
        sortBy: 'age',
        order: 'asc',
      );

      final page = await repo.browse(filters: filters, page: 2);

      expect(page.items.length, 1);
      expect(page.items.first.firstName, 'Fatima');
      expect(capturedQuery, isNotNull);
      expect(capturedQuery!['gender'], 'FEMALE');
      expect(capturedQuery!['ethnicity'], 'Arab');
      expect(capturedQuery!['minAge'], 22);
      expect(capturedQuery!['maxAge'], 30);
      expect(capturedQuery!['sortBy'], 'age');
      expect(capturedQuery!['order'], 'asc');
      expect(capturedQuery!['page'], 2);
    });

    test('copyWith properly clears or updates individual filter fields', () {
      const initial = BrowseFilters(
        gender: 'FEMALE',
        ethnicity: 'South Asian',
        minAge: 20,
        maxAge: 35,
        sortBy: 'createdAt',
        order: 'desc',
      );

      final updated = initial.copyWith(
        ethnicity: null,
        minAge: null,
        maxAge: 40,
        sortBy: 'age',
      );

      expect(updated.gender, 'FEMALE');
      expect(updated.ethnicity, isNull);
      expect(updated.minAge, isNull);
      expect(updated.maxAge, 40);
      expect(updated.sortBy, 'age');
      expect(updated.order, 'desc');
    });
  });
}
