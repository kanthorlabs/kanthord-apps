// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'db_status.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$DbStatus {

@JsonKey(name: 'migrations') List<Migration> get migrations;
/// Create a copy of DbStatus
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$DbStatusCopyWith<DbStatus> get copyWith => _$DbStatusCopyWithImpl<DbStatus>(this as DbStatus, _$identity);

  /// Serializes this DbStatus to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is DbStatus&&const DeepCollectionEquality().equals(other.migrations, migrations));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(migrations));

@override
String toString() {
  return 'DbStatus(migrations: $migrations)';
}


}

/// @nodoc
abstract mixin class $DbStatusCopyWith<$Res>  {
  factory $DbStatusCopyWith(DbStatus value, $Res Function(DbStatus) _then) = _$DbStatusCopyWithImpl;
@useResult
$Res call({
@JsonKey(name: 'migrations') List<Migration> migrations
});




}
/// @nodoc
class _$DbStatusCopyWithImpl<$Res>
    implements $DbStatusCopyWith<$Res> {
  _$DbStatusCopyWithImpl(this._self, this._then);

  final DbStatus _self;
  final $Res Function(DbStatus) _then;

/// Create a copy of DbStatus
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? migrations = null,}) {
  return _then(_self.copyWith(
migrations: null == migrations ? _self.migrations : migrations // ignore: cast_nullable_to_non_nullable
as List<Migration>,
  ));
}

}


/// Adds pattern-matching-related methods to [DbStatus].
extension DbStatusPatterns on DbStatus {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _DbStatus value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _DbStatus() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _DbStatus value)  $default,){
final _that = this;
switch (_that) {
case _DbStatus():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _DbStatus value)?  $default,){
final _that = this;
switch (_that) {
case _DbStatus() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(name: 'migrations')  List<Migration> migrations)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _DbStatus() when $default != null:
return $default(_that.migrations);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(name: 'migrations')  List<Migration> migrations)  $default,) {final _that = this;
switch (_that) {
case _DbStatus():
return $default(_that.migrations);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(name: 'migrations')  List<Migration> migrations)?  $default,) {final _that = this;
switch (_that) {
case _DbStatus() when $default != null:
return $default(_that.migrations);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _DbStatus implements DbStatus {
  const _DbStatus({@JsonKey(name: 'migrations') required final  List<Migration> migrations}): _migrations = migrations;
  factory _DbStatus.fromJson(Map<String, dynamic> json) => _$DbStatusFromJson(json);

 final  List<Migration> _migrations;
@override@JsonKey(name: 'migrations') List<Migration> get migrations {
  if (_migrations is EqualUnmodifiableListView) return _migrations;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_migrations);
}


/// Create a copy of DbStatus
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$DbStatusCopyWith<_DbStatus> get copyWith => __$DbStatusCopyWithImpl<_DbStatus>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$DbStatusToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _DbStatus&&const DeepCollectionEquality().equals(other._migrations, _migrations));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_migrations));

@override
String toString() {
  return 'DbStatus(migrations: $migrations)';
}


}

/// @nodoc
abstract mixin class _$DbStatusCopyWith<$Res> implements $DbStatusCopyWith<$Res> {
  factory _$DbStatusCopyWith(_DbStatus value, $Res Function(_DbStatus) _then) = __$DbStatusCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(name: 'migrations') List<Migration> migrations
});




}
/// @nodoc
class __$DbStatusCopyWithImpl<$Res>
    implements _$DbStatusCopyWith<$Res> {
  __$DbStatusCopyWithImpl(this._self, this._then);

  final _DbStatus _self;
  final $Res Function(_DbStatus) _then;

/// Create a copy of DbStatus
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? migrations = null,}) {
  return _then(_DbStatus(
migrations: null == migrations ? _self._migrations : migrations // ignore: cast_nullable_to_non_nullable
as List<Migration>,
  ));
}


}

// dart format on
