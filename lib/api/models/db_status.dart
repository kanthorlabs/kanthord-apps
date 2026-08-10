import 'package:freezed_annotation/freezed_annotation.dart';

import 'migration.dart';

part 'db_status.freezed.dart';
part 'db_status.g.dart';

@freezed
abstract class DbStatus with _$DbStatus {
  const factory DbStatus({@JsonKey(name: 'migrations') required List<Migration> migrations}) =
      _DbStatus;

  factory DbStatus.fromJson(Map<String, dynamic> json) => _$DbStatusFromJson(json);
}
