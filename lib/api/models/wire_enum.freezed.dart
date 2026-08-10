// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'wire_enum.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$WireEnum<T> {

 T? get known; String get raw;
/// Create a copy of WireEnum
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$WireEnumCopyWith<T, WireEnum<T>> get copyWith => _$WireEnumCopyWithImpl<T, WireEnum<T>>(this as WireEnum<T>, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is WireEnum<T>&&const DeepCollectionEquality().equals(other.known, known)&&(identical(other.raw, raw) || other.raw == raw));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(known),raw);

@override
String toString() {
  return 'WireEnum<$T>(known: $known, raw: $raw)';
}


}

/// @nodoc
abstract mixin class $WireEnumCopyWith<T,$Res>  {
  factory $WireEnumCopyWith(WireEnum<T> value, $Res Function(WireEnum<T>) _then) = _$WireEnumCopyWithImpl;
@useResult
$Res call({
 T? known, String raw
});




}
/// @nodoc
class _$WireEnumCopyWithImpl<T,$Res>
    implements $WireEnumCopyWith<T, $Res> {
  _$WireEnumCopyWithImpl(this._self, this._then);

  final WireEnum<T> _self;
  final $Res Function(WireEnum<T>) _then;

/// Create a copy of WireEnum
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? known = freezed,Object? raw = null,}) {
  return _then(_self.copyWith(
known: freezed == known ? _self.known : known // ignore: cast_nullable_to_non_nullable
as T?,raw: null == raw ? _self.raw : raw // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [WireEnum].
extension WireEnumPatterns<T> on WireEnum<T> {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _WireEnum<T> value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _WireEnum() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _WireEnum<T> value)  $default,){
final _that = this;
switch (_that) {
case _WireEnum():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _WireEnum<T> value)?  $default,){
final _that = this;
switch (_that) {
case _WireEnum() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( T? known,  String raw)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _WireEnum() when $default != null:
return $default(_that.known,_that.raw);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( T? known,  String raw)  $default,) {final _that = this;
switch (_that) {
case _WireEnum():
return $default(_that.known,_that.raw);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( T? known,  String raw)?  $default,) {final _that = this;
switch (_that) {
case _WireEnum() when $default != null:
return $default(_that.known,_that.raw);case _:
  return null;

}
}

}

/// @nodoc


class _WireEnum<T> implements WireEnum<T> {
  const _WireEnum({required this.known, required this.raw});
  

@override final  T? known;
@override final  String raw;

/// Create a copy of WireEnum
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$WireEnumCopyWith<T, _WireEnum<T>> get copyWith => __$WireEnumCopyWithImpl<T, _WireEnum<T>>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _WireEnum<T>&&const DeepCollectionEquality().equals(other.known, known)&&(identical(other.raw, raw) || other.raw == raw));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(known),raw);

@override
String toString() {
  return 'WireEnum<$T>(known: $known, raw: $raw)';
}


}

/// @nodoc
abstract mixin class _$WireEnumCopyWith<T,$Res> implements $WireEnumCopyWith<T, $Res> {
  factory _$WireEnumCopyWith(_WireEnum<T> value, $Res Function(_WireEnum<T>) _then) = __$WireEnumCopyWithImpl;
@override @useResult
$Res call({
 T? known, String raw
});




}
/// @nodoc
class __$WireEnumCopyWithImpl<T,$Res>
    implements _$WireEnumCopyWith<T, $Res> {
  __$WireEnumCopyWithImpl(this._self, this._then);

  final _WireEnum<T> _self;
  final $Res Function(_WireEnum<T>) _then;

/// Create a copy of WireEnum
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? known = freezed,Object? raw = null,}) {
  return _then(_WireEnum<T>(
known: freezed == known ? _self.known : known // ignore: cast_nullable_to_non_nullable
as T?,raw: null == raw ? _self.raw : raw // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
