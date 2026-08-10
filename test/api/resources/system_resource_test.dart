import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/api_config.dart';
import 'package:kanthord/api/api_exception.dart';
import 'package:kanthord/api/base_url_provider.dart';
import 'package:kanthord/api/models/dependency_status.dart';
import 'package:kanthord/api/models/health_status.dart';
import 'package:kanthord/api/resources/system_resource.dart';

import '../dio_mock_adapter.dart';

final class _StubBaseUrlProvider implements BaseUrlProviderType {
  const _StubBaseUrlProvider();

  @override
  Future<String> baseUrl() async => 'http://127.0.0.1:31415';
}

SystemResource _resource(MockHttpClientAdapter adapter) {
  final dio = Dio()..options.baseUrl = 'http://127.0.0.1:31415';
  dio.httpClientAdapter = adapter;
  return SystemResource(dio, const ApiConfig(baseUrlProvider: _StubBaseUrlProvider()));
}

Map<String, dynamic> _example(String fileName) =>
    jsonDecode(File('docs/api/contract/examples/$fileName').readAsStringSync())
        as Map<String, dynamic>;

void main() {
  group('SystemResource', () {
    group('health', () {
      test('should request the health path when health is called', () async {
        // Arrange
        final adapter = MockHttpClientAdapter();
        final resource = _resource(adapter);
        final example = _example('system.health.json');
        final success = example['success'] as Map<String, dynamic>;
        adapter.respond = (_) => jsonResponse(success, 200);

        // Act
        await resource.health();

        // Assert
        expect(adapter.requests.single.path, '/v1/health');
        expect(adapter.requests.single.method, 'GET');
      });

      test('should send the configured receive timeout when health is called', () async {
        // Arrange
        final adapter = MockHttpClientAdapter();
        final resource = _resource(adapter);
        final example = _example('system.health.json');
        final success = example['success'] as Map<String, dynamic>;
        adapter.respond = (_) => jsonResponse(success, 200);

        // Act
        await resource.health();

        // Assert
        expect(adapter.requests.single.receiveTimeout, ApiConfig.receiveTimeout);
      });

      test('should decode the published example when the daemon answers 200', () async {
        // Arrange
        final adapter = MockHttpClientAdapter();
        final resource = _resource(adapter);
        final example = _example('system.health.json');
        final success = example['success'] as Map<String, dynamic>;
        adapter.respond = (_) => jsonResponse(success, 200);

        // Act
        final health = await resource.health();

        // Assert
        expect(health.status.known, HealthStatus.ok);
        expect(health.dependencies, hasLength(1));
        expect(health.dependencies.single.name, 'storage');
        expect(health.dependencies.single.status.known, DependencyStatus.ok);
      });

      test('should throw a response error when the daemon answers 503', () async {
        // Arrange
        final adapter = MockHttpClientAdapter();
        final resource = _resource(adapter);
        final example = _example('system.health.json');
        final failure = example['error'] as Map<String, dynamic>;
        adapter.respond = (_) => jsonResponse(failure, 503);

        // Act
        final result = resource.health();

        // Assert
        await expectLater(
          result,
          throwsA(
            isA<ApiResponseException>().having(
              (exception) => exception.code,
              'code',
              'service-unavailable',
            ),
          ),
        );
      });

      test('should throw a decode error when the body is not an object', () async {
        // Arrange
        final adapter = MockHttpClientAdapter();
        final resource = _resource(adapter);
        adapter.respond = (_) => jsonResponse(<int>[1, 2], 200);

        // Act
        final result = resource.health();

        // Assert
        await expectLater(result, throwsA(isA<ApiDecodeException>()));
      });

      test('should throw a decode error when a required field is missing', () async {
        // Arrange
        final adapter = MockHttpClientAdapter();
        final resource = _resource(adapter);
        adapter.respond = (_) => jsonResponse(<String, dynamic>{'dependencies': <dynamic>[]}, 200);

        // Act
        final result = resource.health();

        // Assert
        await expectLater(result, throwsA(isA<ApiDecodeException>()));
      });
    });

    group('db', () {
      test('should request the db status path when db is called', () async {
        // Arrange
        final adapter = MockHttpClientAdapter();
        final resource = _resource(adapter);
        final example = _example('system.db.json');
        final success = example['success'] as Map<String, dynamic>;
        adapter.respond = (_) => jsonResponse(success, 200);

        // Act
        await resource.db();

        // Assert
        expect(adapter.requests.single.path, '/v1/db/status');
        expect(adapter.requests.single.method, 'GET');
      });

      test('should send the configured receive timeout when db is called', () async {
        // Arrange
        final adapter = MockHttpClientAdapter();
        final resource = _resource(adapter);
        final example = _example('system.db.json');
        final success = example['success'] as Map<String, dynamic>;
        adapter.respond = (_) => jsonResponse(success, 200);

        // Act
        await resource.db();

        // Assert
        expect(adapter.requests.single.receiveTimeout, ApiConfig.receiveTimeout);
      });

      test('should decode the published example when the daemon answers 200', () async {
        // Arrange
        final adapter = MockHttpClientAdapter();
        final resource = _resource(adapter);
        final example = _example('system.db.json');
        final success = example['success'] as Map<String, dynamic>;
        adapter.respond = (_) => jsonResponse(success, 200);

        // Act
        final status = await resource.db();

        // Assert
        final migration = status.migrations.single;
        expect(migration.version, 1);
        expect(migration.name, 'core-entities');
        expect(migration.applied, isTrue);
        expect(migration.appliedAt, 1738368000000);
      });

      test('should throw a response error when the daemon answers 503', () async {
        // Arrange
        final adapter = MockHttpClientAdapter();
        final resource = _resource(adapter);
        final example = _example('system.db.json');
        final failure = example['error'] as Map<String, dynamic>;
        adapter.respond = (_) => jsonResponse(failure, 503);

        // Act
        final result = resource.db();

        // Assert
        await expectLater(
          result,
          throwsA(
            isA<ApiResponseException>().having(
              (exception) => exception.code,
              'code',
              'service-unavailable',
            ),
          ),
        );
      });
    });
  });
}
