import 'package:dio/dio.dart';

import '../api_config.dart';
import '../api_exception.dart';
import '../api_platform.dart';
import '../models/db_status.dart';
import '../models/health.dart';

final class SystemResource {
  const SystemResource(this._dio, this._config);

  final Dio _dio;
  final ApiConfig _config;

  Future<Health> health() => _get('/v1/health', 'system.health', Health.fromJson);

  Future<DbStatus> db() => _get('/v1/db/status', 'system.db', DbStatus.fromJson);

  Future<T> _get<T>(
    String path,
    String operation,
    T Function(Map<String, dynamic> json) decode,
  ) async {
    try {
      final response = await _dio.get<dynamic>(
        path,
        options: Options(receiveTimeout: _config.receiveTimeoutFor(operation)),
      );
      final data = response.data;
      if (data is! Map<String, dynamic>) {
        throw const ApiDecodeException('the daemon answered a body that is not an object');
      }
      return decode(data);
    } on DioException catch (error) {
      throw ApiException.fromDio(error, isWeb: kApiIsWeb);
    } on TypeError {
      throw const ApiDecodeException('the daemon answered a body the model does not accept');
    }
  }
}
