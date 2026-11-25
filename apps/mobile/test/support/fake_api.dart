import 'dart:convert';
import 'dart:typed_data';

import 'package:at_tayyibun/core/api_client.dart';
import 'package:dio/dio.dart';

/// Answers requests from a handler instead of the network.
class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.handler);

  final Future<ResponseBody> Function(RequestOptions options) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) =>
      handler(options);

  @override
  void close({bool force = false}) {}
}

ResponseBody jsonBody(Object? body, {int status = 200}) =>
    ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );

/// A failure that never reached the server, the way Dio reports being offline.
Never connectionFailure(RequestOptions options) => throw DioException(
      requestOptions: options,
      type: DioExceptionType.connectionError,
      message: 'SocketException: Failed host lookup',
    );

ApiClient fakeApiClient(
  Future<ResponseBody> Function(RequestOptions options) handler,
) {
  final dio = Dio(
    BaseOptions(
      baseUrl: 'https://attayyibun.test',
      responseType: ResponseType.json,
    ),
  );
  dio.httpClientAdapter = FakeAdapter(handler);
  return ApiClient.forTesting(dio);
}
