import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/api_config.dart';
import 'package:kanthord/api/base_url_provider.dart';
import 'package:kanthord/api/interceptors/base_url_interceptor.dart';

import 'dio_mock_adapter.dart';

final class _StubBaseUrlProvider implements BaseUrlProviderType {
  const _StubBaseUrlProvider(this.value);

  final String value;

  @override
  Future<String> baseUrl() async => value;
}

final class _MutableBaseUrlProvider implements BaseUrlProviderType {
  _MutableBaseUrlProvider(this.value);

  String value;

  @override
  Future<String> baseUrl() async => value;
}

void main() {
  group('BaseUrlInterceptor', () {
    group('onRequest', () {
      test('should send the request to the stored base URL when the provider holds one', () async {
        // Arrange
        final adapter = MockHttpClientAdapter();
        final dio = Dio()..httpClientAdapter = adapter;
        const provider = _StubBaseUrlProvider('http://127.0.0.1:31415');
        dio.interceptors.add(BaseUrlInterceptor(ApiConfig(baseUrlProvider: provider)));

        // Act
        await dio.get<dynamic>('/v1/health');

        // Assert
        expect(adapter.requests.single.uri.toString(), 'http://127.0.0.1:31415/v1/health');
      });

      test(
        'should send the second request to the new base URL when the provider value changes between two calls',
        () async {
          // Arrange
          final adapter = MockHttpClientAdapter();
          final dio = Dio()..httpClientAdapter = adapter;
          final provider = _MutableBaseUrlProvider('http://127.0.0.1:31415');
          dio.interceptors.add(BaseUrlInterceptor(ApiConfig(baseUrlProvider: provider)));

          // Act
          await dio.get<dynamic>('/v1/health');
          provider.value = 'http://localhost:31415';
          await dio.get<dynamic>('/v1/health');

          // Assert
          expect(adapter.requests[0].uri.toString(), 'http://127.0.0.1:31415/v1/health');
          expect(adapter.requests[1].uri.toString(), 'http://localhost:31415/v1/health');
        },
      );
    });
  });
}
