import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/api_exception.dart';

RequestOptions _requestOptions() =>
    RequestOptions(path: '/v1/health', baseUrl: 'http://127.0.0.1:31415');

DioException _responseError({required int statusCode, required Object data}) {
  final requestOptions = _requestOptions();
  return DioException(
    requestOptions: requestOptions,
    response: Response<dynamic>(requestOptions: requestOptions, statusCode: statusCode, data: data),
    type: DioExceptionType.badResponse,
  );
}

void main() {
  group('ApiException', () {
    group('fromDio', () {
      test('should return the carried exception when the DioException carries an ApiException', () {
        // Arrange
        const carried = ApiUnauthorizedException('carried');
        final error = DioException(requestOptions: _requestOptions(), error: carried);

        // Act
        final exception = ApiException.fromDio(error, isWeb: false);

        // Assert
        expect(identical(exception, carried), isTrue);
      });

      test('should map to a timeout when the type is connectionTimeout', () {
        // Arrange
        final error = DioException(
          requestOptions: _requestOptions(),
          type: DioExceptionType.connectionTimeout,
        );

        // Act
        final exception = ApiException.fromDio(error, isWeb: false);

        // Assert
        expect(exception, isA<ApiTimeoutException>());
      });

      test('should map to a timeout when the type is sendTimeout', () {
        // Arrange
        final error = DioException(
          requestOptions: _requestOptions(),
          type: DioExceptionType.sendTimeout,
        );

        // Act
        final exception = ApiException.fromDio(error, isWeb: false);

        // Assert
        expect(exception, isA<ApiTimeoutException>());
      });

      test('should map to a timeout when the type is receiveTimeout', () {
        // Arrange
        final error = DioException(
          requestOptions: _requestOptions(),
          type: DioExceptionType.receiveTimeout,
        );

        // Act
        final exception = ApiException.fromDio(error, isWeb: false);

        // Assert
        expect(exception, isA<ApiTimeoutException>());
      });

      test('should not map to a timeout when the type is transformTimeout', () {
        // Arrange
        final error = DioException(
          requestOptions: _requestOptions(),
          type: DioExceptionType.transformTimeout,
        );

        // Act
        final exception = ApiException.fromDio(error, isWeb: false);

        // Assert
        expect(exception, isNot(isA<ApiTimeoutException>()));
      });

      test('should map to cancelled when the type is cancel', () {
        // Arrange
        final error = DioException(
          requestOptions: _requestOptions(),
          type: DioExceptionType.cancel,
        );

        // Act
        final exception = ApiException.fromDio(error, isWeb: false);

        // Assert
        expect(exception, isA<ApiCancelledException>());
      });

      test('should map to no network when the type is connectionError', () {
        // Arrange
        final error = DioException(
          requestOptions: _requestOptions(),
          type: DioExceptionType.connectionError,
        );

        // Act
        final exception = ApiException.fromDio(error, isWeb: false);

        // Assert
        expect(exception, isA<ApiNoNetworkException>());
      });

      test('should map to unauthorized when the code is unauthenticated', () {
        // Arrange
        final error = _responseError(
          statusCode: 401,
          data: <String, dynamic>{
            'error': <String, dynamic>{'code': 'unauthenticated', 'message': 'no token'},
          },
        );

        // Act
        final exception = ApiException.fromDio(error, isWeb: false);

        // Assert
        expect(exception, isA<ApiUnauthorizedException>());
        expect(exception.message, 'no token');
      });

      test('should map to not implemented when the code is not-implemented', () {
        // Arrange
        final error = _responseError(
          statusCode: 501,
          data: <String, dynamic>{
            'error': <String, dynamic>{'code': 'not-implemented', 'message': 'not available'},
          },
        );

        // Act
        final exception = ApiException.fromDio(error, isWeb: false);

        // Assert
        expect(exception, isA<ApiNotImplementedException>());
      });

      test('should map to a response error when the code is invalid-request', () {
        // Arrange
        final error = _responseError(
          statusCode: 400,
          data: <String, dynamic>{
            'error': <String, dynamic>{'code': 'invalid-request', 'message': 'invalid'},
          },
        );

        // Act
        final exception = ApiException.fromDio(error, isWeb: false);

        // Assert
        expect(exception, isA<ApiResponseException>());
        final responseException = exception as ApiResponseException;
        expect(responseException.status, 400);
        expect(responseException.code, 'invalid-request');
      });

      test('should map to a response error when the code is origin-forbidden', () {
        // Arrange
        final error = _responseError(
          statusCode: 403,
          data: <String, dynamic>{
            'error': <String, dynamic>{'code': 'origin-forbidden', 'message': 'origin rejected'},
          },
        );

        // Act
        final exception = ApiException.fromDio(error, isWeb: false);

        // Assert
        expect(exception, isA<ApiResponseException>());
        final responseException = exception as ApiResponseException;
        expect(responseException.status, 403);
        expect(responseException.code, 'origin-forbidden');
      });

      test('should map to a response error when the code is not-found', () {
        // Arrange
        final error = _responseError(
          statusCode: 404,
          data: <String, dynamic>{
            'error': <String, dynamic>{'code': 'not-found', 'message': 'missing'},
          },
        );

        // Act
        final exception = ApiException.fromDio(error, isWeb: false);

        // Assert
        expect(exception, isA<ApiResponseException>());
        final responseException = exception as ApiResponseException;
        expect(responseException.status, 404);
        expect(responseException.code, 'not-found');
      });

      test('should map to a response error when the code is internal-error', () {
        // Arrange
        final error = _responseError(
          statusCode: 500,
          data: <String, dynamic>{
            'error': <String, dynamic>{'code': 'internal-error', 'message': 'internal error'},
          },
        );

        // Act
        final exception = ApiException.fromDio(error, isWeb: false);

        // Assert
        expect(exception, isA<ApiResponseException>());
        final responseException = exception as ApiResponseException;
        expect(responseException.status, 500);
        expect(responseException.code, 'internal-error');
      });

      test('should map to a response error when the code is service-unavailable', () {
        // Arrange
        final error = _responseError(
          statusCode: 503,
          data: <String, dynamic>{
            'error': <String, dynamic>{'code': 'service-unavailable', 'message': 'unavailable'},
          },
        );

        // Act
        final exception = ApiException.fromDio(error, isWeb: false);

        // Assert
        expect(exception, isA<ApiResponseException>());
        final responseException = exception as ApiResponseException;
        expect(responseException.status, 503);
        expect(responseException.code, 'service-unavailable');
      });

      test('should keep the raw code when the code is outside the table', () {
        // Arrange
        final error = _responseError(
          statusCode: 418,
          data: <String, dynamic>{
            'error': <String, dynamic>{'code': 'teapot-unknown', 'message': 'short and stout'},
          },
        );

        // Act
        final exception = ApiException.fromDio(error, isWeb: false);

        // Assert
        expect(exception, isA<ApiResponseException>());
        final responseException = exception as ApiResponseException;
        expect(responseException.code, 'teapot-unknown');
      });

      test('should name the host and the config key when the code is host-forbidden', () {
        // Arrange
        final error = _responseError(
          statusCode: 403,
          data: <String, dynamic>{
            'error': <String, dynamic>{'code': 'host-forbidden', 'message': 'host rejected'},
          },
        );

        // Act
        final exception = ApiException.fromDio(error, isWeb: false);

        // Assert
        expect(exception, isA<ApiResponseException>());
        expect(exception.message, contains('127.0.0.1:31415'));
        expect(exception.message, contains('KANTHORD_HTTP_ALLOWED_HOSTS'));
      });

      test('should keep the findings as details when the code is plan-invalid', () {
        // Arrange
        final error = _responseError(
          statusCode: 422,
          data: <String, dynamic>{
            'error': <String, dynamic>{
              'code': 'plan-invalid',
              'message': 'invalid',
              'details': <String, dynamic>{
                'findings': <Map<String, String>>[
                  <String, String>{'code': 'dependency-cycle'},
                ],
              },
            },
          },
        );

        // Act
        final exception = ApiException.fromDio(error, isWeb: false);

        // Assert
        expect(exception, isA<ApiResponseException>());
        final responseException = exception as ApiResponseException;
        expect(responseException.code, 'plan-invalid');
        final findings = responseException.details!['findings'];
        expect(findings, isA<List<dynamic>>());
        expect((findings! as List<dynamic>).length, 1);
      });

      test('should map to a decode error when the body is not the envelope', () {
        // Arrange
        final error = _responseError(statusCode: 500, data: 'not json');

        // Act
        final exception = ApiException.fromDio(error, isWeb: false);

        // Assert
        expect(exception, isA<ApiDecodeException>());
      });

      test('should map to a decode error when the envelope has no code', () {
        // Arrange
        final error = _responseError(
          statusCode: 500,
          data: <String, dynamic>{
            'error': <String, dynamic>{'message': 'x'},
          },
        );

        // Act
        final exception = ApiException.fromDio(error, isWeb: false);

        // Assert
        expect(exception, isA<ApiDecodeException>());
      });

      group('web', () {
        test('should name only the daemon when isWeb is false', () {
          // Arrange
          final error = DioException(
            requestOptions: _requestOptions(),
            type: DioExceptionType.connectionError,
          );

          // Act
          final exception = ApiException.fromDio(error, isWeb: false);

          // Assert
          expect(exception.message, 'no answer from the daemon at 127.0.0.1:31415.');
        });

        test('should name the four causes and the two config keys when isWeb is true', () {
          // Arrange
          final error = DioException(
            requestOptions: _requestOptions(),
            type: DioExceptionType.connectionError,
          );

          // Act
          final exception = ApiException.fromDio(error, isWeb: true);

          // Assert
          expect(exception.message, contains('the daemon is down'));
          expect(exception.message, contains('the origin is rejected'));
          expect(exception.message, contains('the host is rejected'));
          expect(exception.message, contains('DNS failed'));
          expect(exception.message, contains('KANTHORD_HTTP_ALLOWED_ORIGINS'));
          expect(exception.message, contains('KANTHORD_HTTP_ALLOWED_HOSTS'));
        });

        test('should keep the unauthorized subclass when isWeb is true', () {
          // Arrange
          final error = _responseError(
            statusCode: 401,
            data: <String, dynamic>{
              'error': <String, dynamic>{'code': 'unauthenticated', 'message': 'no token'},
            },
          );

          // Act
          final exception = ApiException.fromDio(error, isWeb: true);

          // Assert
          expect(exception, isA<ApiUnauthorizedException>());
        });

        test('should keep the response subclass when isWeb is true', () {
          // Arrange
          final error = _responseError(
            statusCode: 403,
            data: <String, dynamic>{
              'error': <String, dynamic>{'code': 'host-forbidden', 'message': 'host rejected'},
            },
          );

          // Act
          final exception = ApiException.fromDio(error, isWeb: true);

          // Assert
          expect(exception, isA<ApiResponseException>());
          expect(exception.message, contains('KANTHORD_HTTP_ALLOWED_HOSTS'));
        });
      });
    });
  });
}
