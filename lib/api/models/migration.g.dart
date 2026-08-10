// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'migration.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Migration _$MigrationFromJson(Map<String, dynamic> json) => _Migration(
  version: (json['version'] as num).toInt(),
  name: json['name'] as String,
  applied: json['applied'] as bool,
  appliedAt: (json['appliedAt'] as num?)?.toInt(),
);

Map<String, dynamic> _$MigrationToJson(_Migration instance) => <String, dynamic>{
  'version': instance.version,
  'name': instance.name,
  'applied': instance.applied,
  'appliedAt': ?instance.appliedAt,
};
