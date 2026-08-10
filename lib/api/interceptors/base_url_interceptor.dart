import 'package:dio/dio.dart';

import '../api_config.dart';

final class BaseUrlInterceptor extends Interceptor {
  const BaseUrlInterceptor(this._config);

  final ApiConfig _config;

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    options.baseUrl = await _config.baseUrl();
    handler.next(options);
  }
}
