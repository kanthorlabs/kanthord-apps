import 'package:dio/dio.dart';

import '../api_exception.dart';
import '../token_provider.dart';

final class AuthInterceptor extends Interceptor {
  const AuthInterceptor(this._tokens);

  final TokenProviderType _tokens;

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _tokens.token();
    if (token == null || token.isEmpty) {
      handler.reject(
        DioException(
          requestOptions: options,
          error: const ApiUnauthorizedException('no daemon token is configured'),
        ),
      );
      return;
    }
    options.headers['Authorization'] = 'Bearer $token';
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      handler.reject(
        DioException(
          requestOptions: err.requestOptions,
          response: err.response,
          error: const ApiUnauthorizedException('the daemon refused the token'),
        ),
      );
      return;
    }
    handler.next(err);
  }
}
