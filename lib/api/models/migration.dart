import 'package:freezed_annotation/freezed_annotation.dart';

part 'migration.freezed.dart';
part 'migration.g.dart';

@freezed
abstract class Migration with _$Migration {
  const factory Migration({
    @JsonKey(name: 'version') required int version,
    @JsonKey(name: 'name') required String name,
    @JsonKey(name: 'applied') required bool applied,
    @JsonKey(name: 'appliedAt') required int? appliedAt,
  }) = _Migration;

  factory Migration.fromJson(Map<String, dynamic> json) => _$MigrationFromJson(json);
}
