/// Phone-number normalisation. Mirrors apps/web/src/lib/phone.ts exactly —
/// two normalisers that disagree mean a number verified under one spelling and
/// stored under another, which quietly breaks one-account-per-number.
library;

import 'dart:math';
import 'package:flutter/services.dart';

/// Fallback dialling code for input typed without one.
const String kDefaultCountryCode = String.fromEnvironment(
  'DEFAULT_COUNTRY_CODE',
  defaultValue: '+1',
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

/// Formats phone input string:
/// - Allows user to freely delete/edit the country code (+91, +44, +966, +92, etc.)
/// - If starting with +1, formats with US spacing: '+1 XXX XXX XXXX' (3 then 3 then 4)
/// - If starting with other country code (+XX), formats cleanly with spaces
String formatPhoneInput(String value) {
  if (value.isEmpty) return '';

  final trimmed = value.trimLeft();
  if (trimmed.isEmpty) return '';
  if (trimmed == '+') return '+';

  final withPlus = trimmed.startsWith('+') ? trimmed : '+$trimmed';
  final digits = withPlus.replaceAll(RegExp(r'\D'), '');

  if (digits.isEmpty) return '+';

  // US/Canada (+1)
  if (digits.startsWith('1')) {
    final national = digits.length > 1 ? digits.substring(1) : '';
    final d = national.length > 10 ? national.substring(0, 10) : national;

    if (d.isEmpty) return '+1';
    if (d.length <= 3) return '+1 $d';
    if (d.length <= 6) return '+1 ${d.substring(0, 3)} ${d.substring(3)}';
    return '+1 ${d.substring(0, 3)} ${d.substring(3, 6)} ${d.substring(6)}';
  }

  // Other country codes:
  if (digits.length <= 3) {
    return '+$digits';
  }
  if (digits.length <= 7) {
    return '+${digits.substring(0, 2)} ${digits.substring(2)}';
  }
  if (digits.length <= 12) {
    return '+${digits.substring(0, 2)} ${digits.substring(2, 7)} ${digits.substring(7)}';
  }

  // International long numbers up to 15 digits
  final maxDigits = min(digits.length, 15);
  final safeDigits = digits.substring(0, maxDigits);
  final p1 = safeDigits.substring(0, 3);
  final p2 = safeDigits.substring(3, min(6, safeDigits.length));
  final p3 = safeDigits.length > 6 ? safeDigits.substring(6, min(10, safeDigits.length)) : '';
  final p4 = safeDigits.length > 10 ? safeDigits.substring(10) : '';

  return ['+$p1', if (p2.isNotEmpty) p2, if (p3.isNotEmpty) p3, if (p4.isNotEmpty) p4].join(' ');
}

/// A safe TextInputFormatter for phone numbers that prevents backspace lock
/// and avoids mutating controller.value inside onChanged.
class PhoneInputFormatter extends TextInputFormatter {
  const PhoneInputFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    if (newValue.text.isEmpty) {
      return newValue;
    }

    // When deleting, let user delete freely without reformatting interference
    if (oldValue.text.length > newValue.text.length) {
      return newValue;
    }

    // Format new input
    final formatted = formatPhoneInput(newValue.text);
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}
