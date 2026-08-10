import 'package:flutter_test/flutter_test.dart';
import 'package:kanthord/api/models/db_status.dart';

void main() {
  group('DbStatus', () {
    group('fromJson', () {
      test('should decode a migration when appliedAt is a number', () {
        // Arrange
        final json = <String, dynamic>{
          'migrations': <Map<String, dynamic>>[
            <String, dynamic>{
              'version': 1,
              'name': 'core-entities',
              'applied': true,
              'appliedAt': 1738368000000,
            },
          ],
        };

        // Act
        final status = DbStatus.fromJson(json);

        // Assert
        final migration = status.migrations.single;
        expect(migration.version, 1);
        expect(migration.name, 'core-entities');
        expect(migration.applied, isTrue);
        expect(migration.appliedAt, 1738368000000);
      });

      test('should decode a migration when appliedAt is null', () {
        // Arrange
        final json = <String, dynamic>{
          'migrations': <Map<String, dynamic>>[
            <String, dynamic>{
              'version': 1,
              'name': 'core-entities',
              'applied': false,
              'appliedAt': null,
            },
          ],
        };

        // Act
        final status = DbStatus.fromJson(json);

        // Assert
        expect(status.migrations.single.appliedAt, isNull);
      });

      test('should decode an empty list when the daemon reports no migration', () {
        // Arrange
        final json = <String, dynamic>{'migrations': <Map<String, dynamic>>[]};

        // Act
        final status = DbStatus.fromJson(json);

        // Assert
        expect(status.migrations, isEmpty);
      });
    });
  });
}
