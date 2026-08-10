import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/api_config.dart';
import 'package:kanthord/api/base_url_provider.dart';

final class _StubBaseUrlProvider implements BaseUrlProviderType {
  const _StubBaseUrlProvider(this.value);

  final String value;

  @override
  Future<String> baseUrl() async => value;
}

void main() {
  group('ApiConfig', () {
    group('baseUrl', () {
      test('should return the value the provider holds when the provider is read', () async {
        // Arrange
        const config = ApiConfig(baseUrlProvider: _StubBaseUrlProvider('http://127.0.0.1:31415'));

        // Act
        final baseUrl = await config.baseUrl();

        // Assert
        expect(baseUrl, 'http://127.0.0.1:31415');
      });
    });

    group('receiveTimeoutFor', () {
      test('should return the long timeout when the operation is repository.inspect', () {
        // Arrange
        const config = ApiConfig(baseUrlProvider: _StubBaseUrlProvider(''));

        // Act
        final timeout = config.receiveTimeoutFor('repository.inspect');

        // Assert
        expect(timeout, ApiConfig.longReceiveTimeout);
      });

      test('should return the long timeout when the operation is repository.register', () {
        // Arrange
        const config = ApiConfig(baseUrlProvider: _StubBaseUrlProvider(''));

        // Act
        final timeout = config.receiveTimeoutFor('repository.register');

        // Assert
        expect(timeout, ApiConfig.longReceiveTimeout);
      });

      test('should return the long timeout when the operation is plan.import', () {
        // Arrange
        const config = ApiConfig(baseUrlProvider: _StubBaseUrlProvider(''));

        // Act
        final timeout = config.receiveTimeoutFor('plan.import');

        // Assert
        expect(timeout, ApiConfig.longReceiveTimeout);
      });

      test('should return the default timeout when the operation is system.health', () {
        // Arrange
        const config = ApiConfig(baseUrlProvider: _StubBaseUrlProvider(''));

        // Act
        final timeout = config.receiveTimeoutFor('system.health');

        // Assert
        expect(timeout, ApiConfig.receiveTimeout);
      });
    });

    group('clientVersion', () {
      test('should equal the pubspec version when the pubspec is read', () {
        // Arrange
        final versionLine = File(
          'pubspec.yaml',
        ).readAsLinesSync().singleWhere((line) => line.startsWith('version:'));
        final version = versionLine.substring('version:'.length).trim();

        // Act
        const clientVersion = ApiConfig.clientVersion;

        // Assert
        expect(clientVersion, version);
      });
    });

    group('constants', () {
      test('should declare the client header name when the header is sent', () {
        // Arrange
        const header = ApiConfig.clientHeader;

        // Act
        const expected = 'X-Kanthord-Client';

        // Assert
        expect(header, expected);
      });

      test('should declare the connect, send and receive timeouts when the client is built', () {
        // Arrange
        const connectTimeout = ApiConfig.connectTimeout;
        const sendTimeout = ApiConfig.sendTimeout;
        const receiveTimeout = ApiConfig.receiveTimeout;

        // Act
        const expectedConnectTimeout = Duration(seconds: 10);
        const expectedSendTimeout = Duration(seconds: 30);
        const expectedReceiveTimeout = Duration(seconds: 30);

        // Assert
        expect(connectTimeout, expectedConnectTimeout);
        expect(sendTimeout, expectedSendTimeout);
        expect(receiveTimeout, expectedReceiveTimeout);
      });
    });
  });
}
