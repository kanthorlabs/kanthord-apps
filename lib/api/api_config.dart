import 'base_url_provider.dart';

const _kLongReceiveOperations = <String>{
  'repository.inspect',
  'repository.register',
  'plan.import',
};

final class ApiConfig {
  const ApiConfig({required BaseUrlProviderType baseUrlProvider}) : this._(baseUrlProvider);

  const ApiConfig._(this._baseUrlProvider);

  static const String clientHeader = 'X-Kanthord-Client';
  static const String clientVersion = '1.0.0+1';
  static const Duration connectTimeout = Duration(seconds: 10);
  static const Duration sendTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);
  static const Duration longReceiveTimeout = Duration(seconds: 120);

  final BaseUrlProviderType _baseUrlProvider;

  Future<String> baseUrl() => _baseUrlProvider.baseUrl();

  Duration receiveTimeoutFor(String operation) =>
      _kLongReceiveOperations.contains(operation) ? longReceiveTimeout : receiveTimeout;
}
