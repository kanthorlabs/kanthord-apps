// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'health_dependency.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_HealthDependency _$HealthDependencyFromJson(Map<String, dynamic> json) => _HealthDependency(
  name: json['name'] as String,
  status: const DependencyStatusConverter().fromJson(json['status'] as String),
);

Map<String, dynamic> _$HealthDependencyToJson(_HealthDependency instance) => <String, dynamic>{
  'name': instance.name,
  'status': const DependencyStatusConverter().toJson(instance.status),
};
