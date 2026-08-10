// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'health.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Health _$HealthFromJson(Map<String, dynamic> json) => _Health(
  status: const HealthStatusConverter().fromJson(json['status'] as String),
  dependencies: (json['dependencies'] as List<dynamic>)
      .map((e) => HealthDependency.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$HealthToJson(_Health instance) => <String, dynamic>{
  'status': const HealthStatusConverter().toJson(instance.status),
  'dependencies': instance.dependencies.map((e) => e.toJson()).toList(),
};
