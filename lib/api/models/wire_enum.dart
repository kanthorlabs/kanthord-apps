import 'package:freezed_annotation/freezed_annotation.dart';

part 'wire_enum.freezed.dart';

@freezed
abstract class WireEnum<T> with _$WireEnum<T> {
  const factory WireEnum({required T? known, required String raw}) = _WireEnum<T>;
}

abstract base class WireEnumConverter<T> implements JsonConverter<WireEnum<T>, String> {
  const WireEnumConverter(this._byWire);

  final Map<String, T> _byWire;

  @override
  WireEnum<T> fromJson(String json) => WireEnum<T>(known: _byWire[json], raw: json);

  @override
  String toJson(WireEnum<T> object) => object.raw;
}
