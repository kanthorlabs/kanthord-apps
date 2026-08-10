// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'health_dependency.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$HealthDependency {

@JsonKey(name: 'name') String get name;@JsonKey(name: 'status')@DependencyStatusConverter() WireEnum<DependencyStatus> get status;
/// Create a copy of HealthDependency
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$HealthDependencyCopyWith<HealthDependency> get copyWith => _$HealthDependencyCopyWithImpl<HealthDependency>(this as HealthDependency, _$identity);

  /// Serializes this HealthDependency to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is HealthDependency&&(identical(other.name, name) || other.name == name)&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,status);

@override
String toString() {
  return 'HealthDependency(name: $name, status: $status)';
}


}

/// @nodoc
abstract mixin class $HealthDependencyCopyWith<$Res>  {
  factory $HealthDependencyCopyWith(HealthDependency value, $Res Function(HealthDependency) _then) = _$HealthDependencyCopyWithImpl;
@useResult
$Res call({
@JsonKey(name: 'name') String name,@JsonKey(name: 'status')@DependencyStatusConverter() WireEnum<DependencyStatus> status
});


$WireEnumCopyWith<DependencyStatus, $Res> get status;

}
/// @nodoc
class _$HealthDependencyCopyWithImpl<$Res>
    implements $HealthDependencyCopyWith<$Res> {
  _$HealthDependencyCopyWithImpl(this._self, this._then);

  final HealthDependency _self;
  final $Res Function(HealthDependency) _then;

/// Create a copy of HealthDependency
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? name = null,Object? status = null,}) {
  return _then(_self.copyWith(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as WireEnum<DependencyStatus>,
  ));
}
/// Create a copy of HealthDependency
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$WireEnumCopyWith<DependencyStatus, $Res> get status {
  
  return $WireEnumCopyWith<DependencyStatus, $Res>(_self.status, (value) {
    return _then(_self.copyWith(status: value));
  });
}
}


/// Adds pattern-matching-related methods to [HealthDependency].
extension HealthDependencyPatterns on HealthDependency {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _HealthDependency value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _HealthDependency() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _HealthDependency value)  $default,){
final _that = this;
switch (_that) {
case _HealthDependency():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _HealthDependency value)?  $default,){
final _that = this;
switch (_that) {
case _HealthDependency() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(name: 'name')  String name, @JsonKey(name: 'status')@DependencyStatusConverter()  WireEnum<DependencyStatus> status)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _HealthDependency() when $default != null:
return $default(_that.name,_that.status);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(name: 'name')  String name, @JsonKey(name: 'status')@DependencyStatusConverter()  WireEnum<DependencyStatus> status)  $default,) {final _that = this;
switch (_that) {
case _HealthDependency():
return $default(_that.name,_that.status);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(name: 'name')  String name, @JsonKey(name: 'status')@DependencyStatusConverter()  WireEnum<DependencyStatus> status)?  $default,) {final _that = this;
switch (_that) {
case _HealthDependency() when $default != null:
return $default(_that.name,_that.status);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _HealthDependency implements HealthDependency {
  const _HealthDependency({@JsonKey(name: 'name') required this.name, @JsonKey(name: 'status')@DependencyStatusConverter() required this.status});
  factory _HealthDependency.fromJson(Map<String, dynamic> json) => _$HealthDependencyFromJson(json);

@override@JsonKey(name: 'name') final  String name;
@override@JsonKey(name: 'status')@DependencyStatusConverter() final  WireEnum<DependencyStatus> status;

/// Create a copy of HealthDependency
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$HealthDependencyCopyWith<_HealthDependency> get copyWith => __$HealthDependencyCopyWithImpl<_HealthDependency>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$HealthDependencyToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _HealthDependency&&(identical(other.name, name) || other.name == name)&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,status);

@override
String toString() {
  return 'HealthDependency(name: $name, status: $status)';
}


}

/// @nodoc
abstract mixin class _$HealthDependencyCopyWith<$Res> implements $HealthDependencyCopyWith<$Res> {
  factory _$HealthDependencyCopyWith(_HealthDependency value, $Res Function(_HealthDependency) _then) = __$HealthDependencyCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(name: 'name') String name,@JsonKey(name: 'status')@DependencyStatusConverter() WireEnum<DependencyStatus> status
});


@override $WireEnumCopyWith<DependencyStatus, $Res> get status;

}
/// @nodoc
class __$HealthDependencyCopyWithImpl<$Res>
    implements _$HealthDependencyCopyWith<$Res> {
  __$HealthDependencyCopyWithImpl(this._self, this._then);

  final _HealthDependency _self;
  final $Res Function(_HealthDependency) _then;

/// Create a copy of HealthDependency
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? name = null,Object? status = null,}) {
  return _then(_HealthDependency(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as WireEnum<DependencyStatus>,
  ));
}

/// Create a copy of HealthDependency
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$WireEnumCopyWith<DependencyStatus, $Res> get status {
  
  return $WireEnumCopyWith<DependencyStatus, $Res>(_self.status, (value) {
    return _then(_self.copyWith(status: value));
  });
}
}

// dart format on
