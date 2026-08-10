import 'package:dio/dio.dart';

import 'api_config.dart';
import 'interceptors/auth_interceptor.dart';
import 'interceptors/base_url_interceptor.dart';
import 'resources/system_resource.dart';
import 'token_provider.dart';

final class KanthordApi {
  KanthordApi({required ApiConfig config, required TokenProviderType tokens, Dio? dio})
    : _config = config,
      dio = dio ?? Dio() {
    this.dio.options.connectTimeout = ApiConfig.connectTimeout;
    this.dio.options.sendTimeout = ApiConfig.sendTimeout;
    this.dio.options.receiveTimeout = ApiConfig.receiveTimeout;
    this.dio.options.headers[ApiConfig.clientHeader] = ApiConfig.clientVersion;
    this.dio.interceptors.add(BaseUrlInterceptor(config));
    this.dio.interceptors.add(AuthInterceptor(tokens));
  }

  final Dio dio;
  final ApiConfig _config;

  late final SystemResource system = SystemResource(dio, _config);
}
