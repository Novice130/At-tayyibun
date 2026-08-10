import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:path_provider/path_provider.dart';

import 'api_exception.dart';
import 'constants.dart';

/// Single HTTP entry point for the app.
///
/// Auth is entirely cookie-based: better-auth sets a session cookie on sign-in
/// and the NestJS guard reads that same cookie. A [PersistCookieJar] backed by
/// the app-support directory keeps the user signed in across restarts, which is
/// the only session persistence this app needs — there is no bearer token path.
class ApiClient {
  ApiClient._(this.dio, this._cookieJar);

  final Dio dio;
  final PersistCookieJar _cookieJar;

  static Future<ApiClient> create() async {
    final dir = await getApplicationSupportDirectory();
    final jar = PersistCookieJar(
      storage: FileStorage('${dir.path}/.cookies'),
      ignoreExpires: false,
    );

    final dio = Dio(
      BaseOptions(
        baseUrl: kBaseUrl,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 30),
        headers: {'Content-Type': 'application/json'},
        // Handled manually so `null` bodies and error shapes are ours to parse.
        responseType: ResponseType.json,
      ),
    );

    dio.interceptors.add(CookieManager(jar));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          // better-auth's originCheckMiddleware rejects non-GET /auth/*
          // requests without a trusted Origin as soon as the jar holds any
          // cookie for the host. Without this, every action after the first
          // sign-in fails with 403 MISSING_OR_NULL_ORIGIN.
          final isAuthRoute = options.path.startsWith('/auth');
          final isMutation = options.method.toUpperCase() != 'GET';
          if (isAuthRoute && isMutation) {
            options.headers['Origin'] = kOriginHeader;
          }
          return handler.next(options);
        },
      ),
    );

    return ApiClient._(dio, jar);
  }

  Future<void> clearCookies() => _cookieJar.deleteAll();

  /// True when a session cookie is present. Cheap local check — it does not
  /// prove the session is still valid server-side, so callers that need
  /// certainty should hit `GET /auth/get-session`.
  Future<bool> hasSessionCookie() async {
    final cookies = await _cookieJar.loadForRequest(Uri.parse(kBaseUrl));
    return cookies.any(
      (c) => c.name == kSessionCookieSecure || c.name == kSessionCookie,
    );
  }

  Future<T> get<T>(String path, {Map<String, dynamic>? query}) =>
      _send<T>(() => dio.get(path, queryParameters: query));

  Future<T> post<T>(String path, {Object? body}) =>
      _send<T>(() => dio.post(path, data: body));

  Future<T> put<T>(String path, {Object? body}) =>
      _send<T>(() => dio.put(path, data: body));

  Future<T> delete<T>(String path) => _send<T>(() => dio.delete(path));

  Future<T> _send<T>(Future<Response> Function() run) async {
    try {
      final response = await run();
      return response.data as T;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
