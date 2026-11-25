import 'package:flutter_test/flutter_test.dart';
import 'package:at_tayyibun/core/place.dart';

void main() {
  group('formatPlace', () {
    test('title cases the city and uppercases a two-letter state', () {
      expect(formatPlace('lorton', 'va'), 'Lorton, VA');
      expect(formatPlace('NEW YORK', 'ny'), 'New York, NY');
      expect(formatPlace('  falls   church ', ' Va '), 'Falls Church, VA');
    });

    test('title cases hyphenated words and full state names', () {
      expect(
        formatPlace('winston-salem', 'north carolina'),
        'Winston-Salem, North Carolina',
      );
    });

    test('keeps mixed-case words as written', () {
      expect(formatPlace('McLean', 'VA'), 'McLean, VA');
    });

    test('drops missing or empty parts', () {
      expect(formatPlace('lorton', null), 'Lorton');
      expect(formatPlace(null, 'va'), 'VA');
      expect(formatPlace('', '  '), '');
      expect(formatPlace(null, null), '');
    });
  });
}
