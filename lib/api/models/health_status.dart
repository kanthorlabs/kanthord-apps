import 'wire_enum.dart';

enum HealthStatus { ok, degraded }

const _kHealthStatusByWire = <String, HealthStatus>{
  'ok': HealthStatus.ok,
  'degraded': HealthStatus.degraded,
};

final class HealthStatusConverter extends WireEnumConverter<HealthStatus> {
  const HealthStatusConverter() : super(_kHealthStatusByWire);
}
