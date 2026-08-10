// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'db_status.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_DbStatus _$DbStatusFromJson(Map<String, dynamic> json) => _DbStatus(
  migrations: (json['migrations'] as List<dynamic>)
      .map((e) => Migration.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$DbStatusToJson(_DbStatus instance) => <String, dynamic>{
  'migrations': instance.migrations.map((e) => e.toJson()).toList(),
};
