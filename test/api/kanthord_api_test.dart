import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/api_config.dart';
import 'package:kanthord/api/base_url_provider.dart';
import 'package:kanthord/api/interceptors/auth_interceptor.dart';
import 'package:kanthord/api/interceptors/base_url_interceptor.dart';
import 'package:kanthord/api/kanthord_api.dart';
import 'package:kanthord/api/token_provider.dart';

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

final class _StubTokenProvider implements TokenProviderType {
  const _StubTokenProvider();

  @override
  Future<String?> token() async => 'secret';

  @override
  Future<void> save(String token) async {}

  @override
  Future<void> clear() async {}
}

KanthordApi _api(MockHttpClientAdapter adapter, BaseUrlProviderType provider) {
  final dio = Dio()..httpClientAdapter = adapter;
  return KanthordApi(
    config: ApiConfig(baseUrlProvider: provider),
    tokens: const _StubTokenProvider(),
    dio: dio,
  );
}

Map<String, dynamic> _example(String fileName) =>
    jsonDecode(File('docs/api/contract/examples/$fileName').readAsStringSync())
        as Map<String, dynamic>;

void main() {
  group('KanthordApi', () {
    group('constructor', () {
      test('should build a Dio with the configured timeouts when no Dio is passed', () {
        // Arrange
        const config = ApiConfig(baseUrlProvider: _StubBaseUrlProvider('http://127.0.0.1:31415'));

        // Act
        final api = KanthordApi(config: config, tokens: const _StubTokenProvider());

        // Assert
        expect(api.dio.options.connectTimeout, const Duration(seconds: 10));
        expect(api.dio.options.sendTimeout, const Duration(seconds: 30));
        expect(api.dio.options.receiveTimeout, const Duration(seconds: 30));
      });

      test('should send the client version header when no Dio is passed', () {
        // Arrange
        const config = ApiConfig(baseUrlProvider: _StubBaseUrlProvider('http://127.0.0.1:31415'));

        // Act
        final api = KanthordApi(config: config, tokens: const _StubTokenProvider());

        // Assert
        expect(api.dio.options.headers[ApiConfig.clientHeader], ApiConfig.clientVersion);
      });

      test(
        'should install the base URL interceptor before the auth interceptor when the client is built',
        () {
          // Arrange
          const config = ApiConfig(baseUrlProvider: _StubBaseUrlProvider('http://127.0.0.1:31415'));

          // Act
          final api = KanthordApi(config: config, tokens: const _StubTokenProvider());

          // Assert
          expect(api.dio.interceptors[api.dio.interceptors.length - 2], isA<BaseUrlInterceptor>());
          expect(api.dio.interceptors.last, isA<AuthInterceptor>());
        },
      );

      test('should use the passed Dio when a Dio is passed', () {
        // Arrange
        final passedDio = Dio();
        const config = ApiConfig(baseUrlProvider: _StubBaseUrlProvider('http://127.0.0.1:31415'));

        // Act
        final api = KanthordApi(config: config, tokens: const _StubTokenProvider(), dio: passedDio);

        // Assert
        expect(identical(api.dio, passedDio), isTrue);
      });
    });

    group('system', () {
      test('should return the same resource when system is read twice', () {
        // Arrange
        final api = _api(
          MockHttpClientAdapter(),
          const _StubBaseUrlProvider('http://127.0.0.1:31415'),
        );

        // Act
        final first = api.system;
        final second = api.system;

        // Assert
        expect(identical(first, second), isTrue);
      });

      group('health', () {
        test('should send the client version header when a resource method is called', () async {
          // Arrange
          final adapter = MockHttpClientAdapter();
          final api = _api(adapter, _MutableBaseUrlProvider('http://127.0.0.1:31415'));
          final example = _example('system.health.json');
          final success = example['success'] as Map<String, dynamic>;
          adapter.respond = (_) => jsonResponse(success, 200);

          // Act
          await api.system.health();

          // Assert
          expect(adapter.requests.single.headers[ApiConfig.clientHeader], ApiConfig.clientVersion);
        });

        test('should send the bearer token when a resource method is called', () async {
          // Arrange
          final adapter = MockHttpClientAdapter();
          final api = _api(adapter, _MutableBaseUrlProvider('http://127.0.0.1:31415'));
          final example = _example('system.health.json');
          final success = example['success'] as Map<String, dynamic>;
          adapter.respond = (_) => jsonResponse(success, 200);

          // Act
          await api.system.health();

          // Assert
          expect(adapter.requests.single.headers['Authorization'], 'Bearer secret');
        });

        test(
          'should send the second request to the new base URL when the provider value changes between two calls',
          () async {
            // Arrange
            final adapter = MockHttpClientAdapter();
            final provider = _MutableBaseUrlProvider('http://127.0.0.1:31415');
            final api = _api(adapter, provider);
            final example = _example('system.health.json');
            final success = example['success'] as Map<String, dynamic>;
            adapter.respond = (_) => jsonResponse(success, 200);

            // Act
            await api.system.health();
            provider.value = 'http://localhost:31415';
            await api.system.health();

            // Assert
            expect(adapter.requests[0].uri.toString(), 'http://127.0.0.1:31415/v1/health');
            expect(adapter.requests[1].uri.toString(), 'http://localhost:31415/v1/health');
          },
        );
      });
    });
  });
}
