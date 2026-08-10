import 'package:freezed_annotation/freezed_annotation.dart';

import 'health_dependency.dart';
import 'health_status.dart';
import 'wire_enum.dart';

part 'health.freezed.dart';
part 'health.g.dart';

@freezed
abstract class Health with _$Health {
  const factory Health({
    @JsonKey(name: 'status') @HealthStatusConverter() required WireEnum<HealthStatus> status,
    @JsonKey(name: 'dependencies') required List<HealthDependency> dependencies,
  }) = _Health;

  factory Health.fromJson(Map<String, dynamic> json) => _$HealthFromJson(json);
}
