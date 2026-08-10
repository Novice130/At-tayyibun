import 'package:dio/dio.dart';

/// Normalised error from either backend surface.
///
/// The two surfaces disagree on shape, and one of them isn't even an object:
///   NestJS      -> {"message": "...", "error": "...", "statusCode": 404}
///   NestJS 400  -> {"message": ["field must be ..."], ...}   (message is a LIST)
///   NestJS 429  -> "ThrottlerException: Too Many Requests"   (a bare string)
///   better-auth -> {"code": "EMAIL_NOT_VERIFIED", "message": "Email not verified"}
class ApiException implements Exception {
  ApiException({
    required this.message,
    required this.statusCode,
    this.code,
    this.retryAfter,
  });

  final String message;
  final int statusCode;

  /// better-auth error code, e.g. `EMAIL_NOT_VERIFIED`, `INVALID_ORIGIN`.
  final String? code;

  /// Parsed from the Retry-After-* headers on a 429.
  final Duration? retryAfter;

  bool get isUnauthorized => statusCode == 401;
  bool get isConflict => statusCode == 409;
  bool get isRateLimited => statusCode == 429;
  bool get isEmailNotVerified => code == 'EMAIL_NOT_VERIFIED';

  factory ApiException.fromDio(DioException e) {
    final response = e.response;

    if (response == null) {
      final offline = e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout;
      return ApiException(
        message: offline
            ? 'Cannot reach At-Tayyibun. Check your connection and try again.'
            : (e.message ?? 'Something went wrong. Please try again.'),
        statusCode: 0,
      );
    }

    final status = response.statusCode ?? 0;
    final data = response.data;

    if (status == 429) {
      return ApiException(
        message: 'Too many requests. Please wait a moment and try again.',
        statusCode: status,
        retryAfter: _retryAfter(response.headers),
      );
    }

    // The bare-string body case (and any non-JSON error page).
    if (data is String) {
      final text = data.trim();
      return ApiException(
        message: text.isEmpty ? 'Server error ($status)' : _truncate(text),
        statusCode: status,
      );
    }

    if (data is Map) {
      final raw = data['message'];
      final String message;
      if (raw is List) {
        message = raw.map((e) => e.toString()).join('\n');
      } else if (raw is String && raw.isNotEmpty) {
        message = raw;
      } else {
        message = 'Server error ($status)';
      }
      return ApiException(
        message: message,
        statusCode: status,
        code: data['code'] as String?,
      );
    }

    return ApiException(message: 'Server error ($status)', statusCode: status);
  }

  static Duration? _retryAfter(Headers headers) {
    for (final name in const [
      'retry-after-short',
      'retry-after-medium',
      'retry-after-long',
      'retry-after',
    ]) {
      final value = headers.value(name);
      final seconds = value == null ? null : int.tryParse(value);
      if (seconds != null) return Duration(seconds: seconds);
    }
    return null;
  }

  static String _truncate(String s) =>
      s.length <= 200 ? s : '${s.substring(0, 200)}…';

  @override
  String toString() => message;
}
