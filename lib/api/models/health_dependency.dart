import 'package:freezed_annotation/freezed_annotation.dart';

import 'dependency_status.dart';
import 'wire_enum.dart';

part 'health_dependency.freezed.dart';
part 'health_dependency.g.dart';

@freezed
abstract class HealthDependency with _$HealthDependency {
  const factory HealthDependency({
    @JsonKey(name: 'name') required String name,
    @JsonKey(name: 'status')
    @DependencyStatusConverter()
    required WireEnum<DependencyStatus> status,
  }) = _HealthDependency;

  factory HealthDependency.fromJson(Map<String, dynamic> json) => _$HealthDependencyFromJson(json);
}
