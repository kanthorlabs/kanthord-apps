import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/models/dependency_status.dart';
import 'package:kanthord/api/models/health.dart';
import 'package:kanthord/api/models/health_status.dart';

void main() {
  group('Health', () {
    group('fromJson', () {
      test('should decode the status and the dependencies when the daemon reports ok', () {
        // Arrange
        final json = <String, dynamic>{
          'status': 'ok',
          'dependencies': <Map<String, dynamic>>[
            <String, dynamic>{'name': 'storage', 'status': 'ok'},
          ],
        };

        // Act
        final health = Health.fromJson(json);

        // Assert
        expect(health.status.known, HealthStatus.ok);
        expect(health.dependencies, hasLength(1));
        expect(health.dependencies.single.name, 'storage');
        expect(health.dependencies.single.status.known, DependencyStatus.ok);
      });

      test('should decode the degraded roll-up when a dependency failed', () {
        // Arrange
        final json = <String, dynamic>{
          'status': 'degraded',
          'dependencies': <Map<String, dynamic>>[
            <String, dynamic>{'name': 'storage', 'status': 'failed'},
          ],
        };

        // Act
        final health = Health.fromJson(json);

        // Assert
        expect(health.status.known, HealthStatus.degraded);
        expect(health.dependencies.single.status.known, DependencyStatus.failed);
      });

      test('should keep the raw value when the status is unknown', () {
        // Arrange
        final json = <String, dynamic>{
          'status': 'sideways',
          'dependencies': <Map<String, dynamic>>[],
        };

        // Act
        final health = Health.fromJson(json);

        // Assert
        expect(health.status.known, isNull);
        expect(health.status.raw, 'sideways');
      });

      test('should ignore an unknown field when the daemon adds one', () {
        // Arrange
        final json = <String, dynamic>{
          'status': 'ok',
          'dependencies': <Map<String, dynamic>>[],
          'futureField': 1,
        };

        // Act
        final health = Health.fromJson(json);

        // Assert
        expect(health.status.known, HealthStatus.ok);
      });
    });
  });
}
