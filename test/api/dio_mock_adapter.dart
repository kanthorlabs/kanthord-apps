import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

final class MockHttpClientAdapter implements HttpClientAdapter {
  final List<RequestOptions> requests = <RequestOptions>[];

  ResponseBody Function(RequestOptions options) respond = (options) =>
      jsonResponse(<String, dynamic>{}, 200);

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return respond(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody jsonResponse(Object body, int status) => ResponseBody.fromString(
  jsonEncode(body),
  status,
  headers: <String, List<String>>{
    Headers.contentTypeHeader: <String>[Headers.jsonContentType],
  },
);
