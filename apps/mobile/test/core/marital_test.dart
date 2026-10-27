import 'package:flutter_test/flutter_test.dart';
import 'package:at_tayyibun/core/marital.dart';

void main() {
  group('formatMaritalLine', () {
    test('plural children', () {
      expect(formatMaritalLine('DIVORCED', true, 2), 'Divorced · 2 children');
    });
    test('no children', () {
      expect(formatMaritalLine('NEVER_MARRIED', false, null),
          'Never married · No children');
    });
    test('single child', () {
      expect(formatMaritalLine('WIDOWED', true, 1), 'Widowed · 1 child');
    });
    test('has children without count', () {
      expect(formatMaritalLine('WIDOWED', true, null), 'Widowed · Has children');
    });
    test('null status', () {
      expect(formatMaritalLine(null, null, null), isNull);
    });
  });
}
