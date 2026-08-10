import 'wire_enum.dart';

enum DependencyStatus { ok, failed, notImplemented }

const _kDependencyStatusByWire = <String, DependencyStatus>{
  'ok': DependencyStatus.ok,
  'failed': DependencyStatus.failed,
  'not-implemented': DependencyStatus.notImplemented,
};

final class DependencyStatusConverter extends WireEnumConverter<DependencyStatus> {
  const DependencyStatusConverter() : super(_kDependencyStatusByWire);
}
