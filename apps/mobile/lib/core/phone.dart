/// Phone-number normalisation. Mirrors apps/web/src/lib/phone.ts exactly —
/// two normalisers that disagree mean a number verified under one spelling and
/// stored under another, which quietly breaks one-account-per-number.
library;

/// Fallback dialling code for input typed without one.
const String kDefaultCountryCode = String.fromEnvironment(
  'DEFAULT_COUNTRY_CODE',
  defaultValue: '+92',
);

/// Normalise free-typed input to E.164, or null if it cannot be.
///
/// 15 digits is E.164's maximum and also keeps the result inside users.phone's
/// varchar(20). Unbounded input reached Postgres and failed as an opaque 500.
String? toE164(String raw) {
  final trimmed = raw.trim();
  final digits = trimmed.replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) return null;

  if (trimmed.startsWith('+')) {
    return digits.length >= 7 && digits.length <= 15 ? '+$digits' : null;
  }

  // 00 is the other way people write the international prefix.
  if (digits.startsWith('00')) {
    final rest = digits.substring(2);
    return rest.length >= 7 && rest.length <= 15 ? '+$rest' : null;
  }

  final cc = kDefaultCountryCode.replaceAll(RegExp(r'\D'), '');

  // National format with a trunk prefix: 03001234567 -> +923001234567.
  if (digits.startsWith('0')) {
    final joined = '$cc${digits.substring(1)}';
    return joined.length >= 7 && joined.length <= 15 ? '+$joined' : null;
  }

  if (digits.startsWith(cc) && digits.length >= 7 && digits.length <= 15) {
    return '+$digits';
  }
  final joined = '$cc$digits';
  return joined.length >= 7 && joined.length <= 15 ? '+$joined' : null;
}
