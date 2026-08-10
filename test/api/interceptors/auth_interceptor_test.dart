import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/api_exception.dart';
import 'package:kanthord/api/interceptors/auth_interceptor.dart';
import 'package:kanthord/api/token_provider.dart';
import 'package:mockito/annotations.dart';
import 'package:mockito/mockito.dart';

import '../dio_mock_adapter.dart';
import 'auth_interceptor_test.mocks.dart';

@GenerateMocks([TokenProviderType])
void main() {
  group('AuthInterceptor', () {
    group('onRequest', () {
      test('should attach the bearer token when a token is stored', () async {
        // Arrange
        final tokens = MockTokenProviderType();
        when(tokens.token()).thenAnswer((_) async => 'secret');
        final adapter = MockHttpClientAdapter();
        final dio = Dio(BaseOptions(baseUrl: 'http://127.0.0.1:31415'))
          ..httpClientAdapter = adapter
          ..interceptors.add(AuthInterceptor(tokens));

        // Act
        await dio.get<dynamic>('/v1/health');

        // Assert
        expect(adapter.requests.single.headers['Authorization'], 'Bearer secret');
      });

      test('should throw unauthorized before the request leaves when the token is null', () async {
        // Arrange
        final tokens = MockTokenProviderType();
        when(tokens.token()).thenAnswer((_) async => null);
        final adapter = MockHttpClientAdapter();
        final dio = Dio(BaseOptions(baseUrl: 'http://127.0.0.1:31415'))
          ..httpClientAdapter = adapter
          ..interceptors.add(AuthInterceptor(tokens));

        // Act
        final request = dio.get<dynamic>('/v1/health');

        // Assert
        await expectLater(
          request,
          throwsA(
            isA<DioException>().having(
              (error) => error.error,
              'error',
              isA<ApiUnauthorizedException>(),
            ),
          ),
        );
        expect(adapter.requests, isEmpty);
      });

      test('should throw unauthorized before the request leaves when the token is empty', () async {
        // Arrange
        final tokens = MockTokenProviderType();
        when(tokens.token()).thenAnswer((_) async => '');
        final adapter = MockHttpClientAdapter();
        final dio = Dio(BaseOptions(baseUrl: 'http://127.0.0.1:31415'))
          ..httpClientAdapter = adapter
          ..interceptors.add(AuthInterceptor(tokens));

        // Act
        final request = dio.get<dynamic>('/v1/health');

        // Assert
        await expectLater(
          request,
          throwsA(
            isA<DioException>().having(
              (error) => error.error,
              'error',
              isA<ApiUnauthorizedException>(),
            ),
          ),
        );
        expect(adapter.requests, isEmpty);
      });
    });

    group('onError', () {
      test('should throw unauthorized when the daemon answers 401', () async {
        // Arrange
        final tokens = MockTokenProviderType();
        when(tokens.token()).thenAnswer((_) async => 'secret');
        final adapter = MockHttpClientAdapter()
          ..respond = (_) => jsonResponse(<String, dynamic>{
            'error': <String, dynamic>{'code': 'unauthenticated', 'message': 'no token'},
          }, 401);
        final dio = Dio(BaseOptions(baseUrl: 'http://127.0.0.1:31415'))
          ..httpClientAdapter = adapter
          ..interceptors.add(AuthInterceptor(tokens));

        // Act
        final request = dio.get<dynamic>('/v1/health');

        // Assert
        await expectLater(
          request,
          throwsA(
            isA<DioException>().having(
              (error) => error.error,
              'error',
              isA<ApiUnauthorizedException>(),
            ),
          ),
        );
        expect(adapter.requests, hasLength(1));
      });

      test('should keep the stored token when the daemon answers 401', () async {
        // Arrange
        final tokens = MockTokenProviderType();
        when(tokens.token()).thenAnswer((_) async => 'secret');
        final adapter = MockHttpClientAdapter()
          ..respond = (_) => jsonResponse(<String, dynamic>{
            'error': <String, dynamic>{'code': 'unauthenticated', 'message': 'no token'},
          }, 401);
        final dio = Dio(BaseOptions(baseUrl: 'http://127.0.0.1:31415'))
          ..httpClientAdapter = adapter
          ..interceptors.add(AuthInterceptor(tokens));

        // Act
        await expectLater(dio.get<dynamic>('/v1/health'), throwsA(isA<DioException>()));

        // Assert
        verifyNever(tokens.clear());
        expect(await tokens.token(), 'secret');
      });
    });
  });
}
