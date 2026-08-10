import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/token_provider.dart';

final class _RecordingTokenProvider implements TokenProviderType {
  String? _value;

  @override
  Future<String?> token() async => _value;

  @override
  Future<void> save(String token) async {
    _value = token;
  }

  @override
  Future<void> clear() async {
    _value = null;
  }
}

void main() {
  group('TokenProviderType', () {
    group('token', () {
      test('should return null when no token is saved', () async {
        // Arrange
        final provider = _RecordingTokenProvider();

        // Act
        final token = await provider.token();

        // Assert
        expect(token, isNull);
      });

      test('should return the saved token when save was called', () async {
        // Arrange
        final provider = _RecordingTokenProvider();

        // Act
        await provider.save('secret');
        final token = await provider.token();

        // Assert
        expect(token, 'secret');
      });

      test('should return null when clear was called', () async {
        // Arrange
        final provider = _RecordingTokenProvider();

        // Act
        await provider.save('secret');
        await provider.clear();
        final token = await provider.token();

        // Assert
        expect(token, isNull);
      });
    });
  });
}
