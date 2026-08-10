import 'package:dio/dio.dart';

sealed class ApiException implements Exception {
  const ApiException(this.message);

  final String message;

  static ApiException fromDio(DioException error, {required bool isWeb}) {
    final carriedException = error.error;
    if (carriedException is ApiException) {
      return carriedException;
    }

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const ApiTimeoutException('the daemon did not answer in time');
      case DioExceptionType.transformTimeout:
        return _fromResponse(error);
      case DioExceptionType.cancel:
        return const ApiCancelledException('the request was cancelled');
      case DioExceptionType.connectionError:
      case DioExceptionType.badCertificate:
      case DioExceptionType.unknown:
        final authority = error.requestOptions.uri.authority;
        final message = isWeb
            ? 'no answer from the daemon at $authority. A browser cannot tell these four causes '
                  'apart: the daemon is down, the origin is rejected, the host is rejected, or DNS '
                  'failed. Check KANTHORD_HTTP_ALLOWED_ORIGINS and KANTHORD_HTTP_ALLOWED_HOSTS on the '
                  'daemon.'
            : 'no answer from the daemon at $authority.';
        return ApiNoNetworkException(message);
      case DioExceptionType.badResponse:
        return _fromResponse(error);
    }
  }

  static ApiException _fromResponse(DioException error) {
    const decodeMessage = 'the daemon answered a body that is not the error envelope';
    final response = error.response;
    final data = response?.data;
    if (data is! Map<String, dynamic>) {
      return const ApiDecodeException(decodeMessage);
    }

    final envelope = data['error'];
    if (envelope is! Map<String, dynamic>) {
      return const ApiDecodeException(decodeMessage);
    }

    final code = envelope['code'];
    final message = envelope['message'];
    if (code is! String || message is! String) {
      return const ApiDecodeException(decodeMessage);
    }

    final details = envelope['details'];
    final status = response?.statusCode ?? 0;
    final decodedDetails = details is Map<String, dynamic> ? details : null;
    if (code == 'unauthenticated') {
      return ApiUnauthorizedException(message);
    }
    if (code == 'not-implemented') {
      return ApiNotImplementedException(message);
    }
    if (code == 'host-forbidden') {
      final authority = error.requestOptions.uri.authority;
      return ApiResponseException(
        status: status,
        code: code,
        message:
            'the daemon refused the Host header $authority. '
            'Add it to KANTHORD_HTTP_ALLOWED_HOSTS on the daemon.',
        details: decodedDetails,
      );
    }
    return ApiResponseException(
      status: status,
      code: code,
      message: message,
      details: decodedDetails,
    );
  }
}

final class ApiNoNetworkException extends ApiException {
  const ApiNoNetworkException(super.message);
}

final class ApiTimeoutException extends ApiException {
  const ApiTimeoutException(super.message);
}

final class ApiUnauthorizedException extends ApiException {
  const ApiUnauthorizedException(super.message);
}

final class ApiNotImplementedException extends ApiException {
  const ApiNotImplementedException(super.message);
}

final class ApiResponseException extends ApiException {
  const ApiResponseException({
    required this.status,
    required this.code,
    required String message,
    this.details,
  }) : super(message);

  final int status;
  final String code;
  final Map<String, dynamic>? details;
}

final class ApiDecodeException extends ApiException {
  const ApiDecodeException(super.message);
}

final class ApiCancelledException extends ApiException {
  const ApiCancelledException(super.message);
}
