import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/models/dependency_status.dart';
import 'package:kanthord/api/models/health_status.dart';

void main() {
  group('WireEnumConverter', () {
    group('fromJson', () {
      test('should return the known case when the wire value is ok', () {
        // Arrange
        const converter = HealthStatusConverter();

        // Act
        final value = converter.fromJson('ok');

        // Assert
        expect(value.known, HealthStatus.ok);
        expect(value.raw, 'ok');
      });

      test('should return the known case when the wire value is degraded', () {
        // Arrange
        const converter = HealthStatusConverter();

        // Act
        final value = converter.fromJson('degraded');

        // Assert
        expect(value.known, HealthStatus.degraded);
        expect(value.raw, 'degraded');
      });

      test('should keep the raw value and no known case when the wire value is unknown', () {
        // Arrange
        const converter = HealthStatusConverter();

        // Act
        final value = converter.fromJson('sideways');

        // Assert
        expect(value.known, isNull);
        expect(value.raw, 'sideways');
      });

      test(
        'should map the hyphenated wire value when the dependency status is not-implemented',
        () {
          // Arrange
          const converter = DependencyStatusConverter();

          // Act
          final value = converter.fromJson('not-implemented');

          // Assert
          expect(value.known, DependencyStatus.notImplemented);
          expect(value.raw, 'not-implemented');
        },
      );
    });

    group('toJson', () {
      test('should return the raw value when the case is known', () {
        // Arrange
        const converter = HealthStatusConverter();
        final value = converter.fromJson('ok');

        // Act
        final json = converter.toJson(value);

        // Assert
        expect(json, 'ok');
      });

      test('should return the raw value when the case is unknown', () {
        // Arrange
        const converter = HealthStatusConverter();
        final value = converter.fromJson('sideways');

        // Act
        final json = converter.toJson(value);

        // Assert
        expect(json, 'sideways');
      });
    });
  });
}
