import 'package:flutter_test/flutter_test.dart';
import 'package:at_tayyibun/core/phone.dart';

void main() {
  group('toE164', () {
    test('normalizes US numbers with +1', () {
      expect(toE164('+1 (555) 123-4567'), '+15551234567');
      expect(toE164('+1 555 123 4567'), '+15551234567');
      expect(toE164('+15551234567'), '+15551234567');
    });

    test('normalizes international numbers', () {
      expect(toE164('+92 300 1234567'), '+923001234567');
      expect(toE164('+44 7911 123456'), '+447911123456');
      expect(toE164('+966 50 123 4567'), '+966501234567');
    });

    test('rejects too short or empty', () {
      expect(toE164(''), isNull);
      expect(toE164('+123'), isNull);
    });
  });

  group('formatPhoneInput', () {
    test('formats US numbers', () {
      expect(formatPhoneInput(''), '');
      expect(formatPhoneInput('+'), '+');
      expect(formatPhoneInput('+1'), '+1');
      expect(formatPhoneInput('+1555'), '+1 555');
      expect(formatPhoneInput('+1555123'), '+1 555 123');
      expect(formatPhoneInput('+15551234567'), '+1 555 123 4567');
    });

    test('formats international numbers without RangeError', () {
      expect(formatPhoneInput('+92'), '+92');
      expect(formatPhoneInput('+923'), '+923');
      expect(formatPhoneInput('+923001'), '+92 3001');
      expect(formatPhoneInput('+923001234567'), '+92 30012 34567');
      expect(formatPhoneInput('+9230012345678'), '+923 001 2345 678');
    });
  });

  group('PhoneInputFormatter', () {
    const formatter = PhoneInputFormatter();

    test('formats new characters typed', () {
      const oldVal = TextEditingValue(text: '+1');
      const newVal = TextEditingValue(text: '+15');
      final formatted = formatter.formatEditUpdate(oldVal, newVal);
      expect(formatted.text, '+1 5');
    });

    test('allows backspacing without locking', () {
      const oldVal = TextEditingValue(text: '+1 555');
      const newVal = TextEditingValue(text: '+1 55');
      final formatted = formatter.formatEditUpdate(oldVal, newVal);
      expect(formatted.text, '+1 55');
    });
  });
}
