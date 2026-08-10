abstract class TokenProviderType {
  Future<String?> token();
  Future<void> save(String token);
  Future<void> clear();
}
