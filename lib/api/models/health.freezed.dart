// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'health.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$Health {

@JsonKey(name: 'status')@HealthStatusConverter() WireEnum<HealthStatus> get status;@JsonKey(name: 'dependencies') List<HealthDependency> get dependencies;
/// Create a copy of Health
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$HealthCopyWith<Health> get copyWith => _$HealthCopyWithImpl<Health>(this as Health, _$identity);

  /// Serializes this Health to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Health&&(identical(other.status, status) || other.status == status)&&const DeepCollectionEquality().equals(other.dependencies, dependencies));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,const DeepCollectionEquality().hash(dependencies));

@override
String toString() {
  return 'Health(status: $status, dependencies: $dependencies)';
}


}

/// @nodoc
abstract mixin class $HealthCopyWith<$Res>  {
  factory $HealthCopyWith(Health value, $Res Function(Health) _then) = _$HealthCopyWithImpl;
@useResult
$Res call({
@JsonKey(name: 'status')@HealthStatusConverter() WireEnum<HealthStatus> status,@JsonKey(name: 'dependencies') List<HealthDependency> dependencies
});


$WireEnumCopyWith<HealthStatus, $Res> get status;

}
/// @nodoc
class _$HealthCopyWithImpl<$Res>
    implements $HealthCopyWith<$Res> {
  _$HealthCopyWithImpl(this._self, this._then);

  final Health _self;
  final $Res Function(Health) _then;

/// Create a copy of Health
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? status = null,Object? dependencies = null,}) {
  return _then(_self.copyWith(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as WireEnum<HealthStatus>,dependencies: null == dependencies ? _self.dependencies : dependencies // ignore: cast_nullable_to_non_nullable
as List<HealthDependency>,
  ));
}
/// Create a copy of Health
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$WireEnumCopyWith<HealthStatus, $Res> get status {
  
  return $WireEnumCopyWith<HealthStatus, $Res>(_self.status, (value) {
    return _then(_self.copyWith(status: value));
  });
}
}


/// Adds pattern-matching-related methods to [Health].
extension HealthPatterns on Health {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Health value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Health() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Health value)  $default,){
final _that = this;
switch (_that) {
case _Health():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Health value)?  $default,){
final _that = this;
switch (_that) {
case _Health() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(name: 'status')@HealthStatusConverter()  WireEnum<HealthStatus> status, @JsonKey(name: 'dependencies')  List<HealthDependency> dependencies)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Health() when $default != null:
return $default(_that.status,_that.dependencies);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(name: 'status')@HealthStatusConverter()  WireEnum<HealthStatus> status, @JsonKey(name: 'dependencies')  List<HealthDependency> dependencies)  $default,) {final _that = this;
switch (_that) {
case _Health():
return $default(_that.status,_that.dependencies);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(name: 'status')@HealthStatusConverter()  WireEnum<HealthStatus> status, @JsonKey(name: 'dependencies')  List<HealthDependency> dependencies)?  $default,) {final _that = this;
switch (_that) {
case _Health() when $default != null:
return $default(_that.status,_that.dependencies);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Health implements Health {
  const _Health({@JsonKey(name: 'status')@HealthStatusConverter() required this.status, @JsonKey(name: 'dependencies') required final  List<HealthDependency> dependencies}): _dependencies = dependencies;
  factory _Health.fromJson(Map<String, dynamic> json) => _$HealthFromJson(json);

@override@JsonKey(name: 'status')@HealthStatusConverter() final  WireEnum<HealthStatus> status;
 final  List<HealthDependency> _dependencies;
@override@JsonKey(name: 'dependencies') List<HealthDependency> get dependencies {
  if (_dependencies is EqualUnmodifiableListView) return _dependencies;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_dependencies);
}


/// Create a copy of Health
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$HealthCopyWith<_Health> get copyWith => __$HealthCopyWithImpl<_Health>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$HealthToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Health&&(identical(other.status, status) || other.status == status)&&const DeepCollectionEquality().equals(other._dependencies, _dependencies));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,const DeepCollectionEquality().hash(_dependencies));

@override
String toString() {
  return 'Health(status: $status, dependencies: $dependencies)';
}


}

/// @nodoc
abstract mixin class _$HealthCopyWith<$Res> implements $HealthCopyWith<$Res> {
  factory _$HealthCopyWith(_Health value, $Res Function(_Health) _then) = __$HealthCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(name: 'status')@HealthStatusConverter() WireEnum<HealthStatus> status,@JsonKey(name: 'dependencies') List<HealthDependency> dependencies
});


@override $WireEnumCopyWith<HealthStatus, $Res> get status;

}
/// @nodoc
class __$HealthCopyWithImpl<$Res>
    implements _$HealthCopyWith<$Res> {
  __$HealthCopyWithImpl(this._self, this._then);

  final _Health _self;
  final $Res Function(_Health) _then;

/// Create a copy of Health
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? status = null,Object? dependencies = null,}) {
  return _then(_Health(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as WireEnum<HealthStatus>,dependencies: null == dependencies ? _self._dependencies : dependencies // ignore: cast_nullable_to_non_nullable
as List<HealthDependency>,
  ));
}

/// Create a copy of Health
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$WireEnumCopyWith<HealthStatus, $Res> get status {
  
  return $WireEnumCopyWith<HealthStatus, $Res>(_self.status, (value) {
    return _then(_self.copyWith(status: value));
  });
}
}

// dart format on
